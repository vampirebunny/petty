import { getSupabase } from '../compliance/supabase';
import { noteServerTime } from '../db/accountMeta';
import { Sentry } from '../monitoring/sentry';
import { kick } from '../sync/queue';
import {
  isRaceClass,
  isRaceEvent,
  type CardState,
  type RaceClass,
  type RaceCup,
  type RaceEvent,
  type RaceSignup,
  type SpeciesAllowed,
} from '../sim/stadium';
import type { Equipped, Look } from '../sim/types';
import type { RaceReportInputLog } from './raceReport';

export type { RaceReportInputLog } from './raceReport';

export type RaceModifiers = {
  energy: number;
  mood: number;
  stamina: number;
  agility: number;
  intelligence: number;
};

export type StadiumCard = {
  id: string;
  event: RaceEvent;
  cup: RaceCup;
  speciesAllowed: SpeciesAllowed;
  requiredTrick: string | null;
  isAway: boolean;
  awayLocation: string | null;
  state: CardState;
  signedUp: number;
  /** When this event's rest ends. Null when the pet can enter. */
  restUntil: number | null;
};

export type StadiumSlot = {
  id: number;
  startsAt: number;
  events: StadiumCard[];
};

export type StadiumBoard = {
  classId: RaceClass;
  species: 'dog' | 'cat';
  capacity: number;
  cooldownUntil: number | null;
  activeEntry: RaceSignup | null;
  /** The pet's friend game, which never shows as activeEntry. */
  friendGameRaceId: string | null;
  slots: StadiumSlot[];
};

export type LineupRow = {
  key: string;
  lane: number;
  petName: string;
  species: 'dog' | 'cat';
  level: number | null;
  handle: string | null;
  checkedIn: boolean;
  mine: boolean;
  npc: boolean;
  skill: number | null;
  modifiers: RaceModifiers | null;
  finishMs: number | null;
  place: number | null;
  coat: string | null;
  breedId: string | null;
  /** Other players' pets: coat, outfit, and age from the server copy of the pet. Null for NPCs. */
  look: Look | null;
  equipped: Equipped | null;
  ageDays: number | null;
  /** Distance events: best distance in tenths of a meter. */
  scoreDm: number | null;
  /** Distance events: each attempt's distance in meters, in order. */
  attemptsM: number[];
  /** Distance events: 0-based attempt of the best jump. */
  bestAttempt: number | null;
};

export type RaceStatus = 'open' | 'locked' | 'countdown' | 'running' | 'finished' | 'cancelled';

export type RaceView = {
  raceId: string;
  status: RaceStatus;
  classId: RaceClass;
  event: RaceEvent;
  cup: RaceCup;
  startsAt: number;
  seed: string;
  configVersion: string;
  players: LineupRow[];
  npcs: LineupRow[];
};

export type StadiumResult<T> = { ok: true; data: T } | { ok: false; offline: boolean; reason: string };

type Row = Record<string, unknown>;

const offlinePattern = /network|fetch|timeout|offline|abort/i;

function rowOf(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function time(value: unknown): number | null {
  const raw = text(value);
  if (!raw) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function speciesOf(value: unknown): 'dog' | 'cat' {
  return value === 'cat' ? 'cat' : 'dog';
}

export function parseEntry(value: unknown): RaceSignup | null {
  const row = rowOf(value);
  const entryId = text(row.entry_id);
  const raceId = text(row.race_id);
  const eventId = text(row.event_id);
  const startsAt = time(row.starts_at);
  if (!entryId || !raceId || !eventId || startsAt == null || !isRaceEvent(row.event_type)) {
    return null;
  }
  return {
    entryId,
    raceId,
    eventId,
    event: row.event_type,
    startsAt,
    classId: isRaceClass(row.class) ? row.class : 'beginner',
    lane: num(row.lane) ?? 1,
  };
}

function cupOf(value: unknown): RaceCup {
  return value === 'veteran' || value === 'friends' ? value : 'open';
}

const cardStates: CardState[] = ['open', 'entered', 'busy', 'resting', 'missing_trick', 'wrong_species', 'closed'];

function parseCard(value: unknown): StadiumCard | null {
  const row = rowOf(value);
  const id = text(row.id);
  if (!id || !isRaceEvent(row.event_type)) {
    return null;
  }
  const allowed = row.species_allowed === 'dog' || row.species_allowed === 'cat' ? row.species_allowed : 'both';
  const state = cardStates.includes(row.state as CardState) ? (row.state as CardState) : 'closed';
  return {
    id,
    event: row.event_type,
    speciesAllowed: allowed,
    cup: row.cup === 'veteran' ? 'veteran' : 'open',
    requiredTrick: text(row.required_trick),
    isAway: row.is_away === true,
    awayLocation: text(row.away_location),
    state,
    signedUp: num(row.signed_up) ?? 0,
    restUntil: time(row.rest_until),
  };
}

export function parseBoard(value: unknown): StadiumBoard {
  const row = rowOf(value);
  const config = rowOf(row.config);
  const slots = Array.isArray(row.slots) ? row.slots : [];
  return {
    classId: isRaceClass(row.class) ? row.class : 'beginner',
    species: speciesOf(row.species),
    capacity: num(config.capacity) ?? 6,
    cooldownUntil: time(row.cooldown_until),
    activeEntry: parseEntry(row.active_entry),
    friendGameRaceId: text(row.friend_game_race_id),
    slots: slots.flatMap((slot) => {
      const item = rowOf(slot);
      const startsAt = time(item.starts_at);
      const id = num(item.id);
      if (startsAt == null || id == null) {
        return [];
      }
      const events = Array.isArray(item.events) ? item.events : [];
      return [{ id, startsAt, events: events.flatMap((card) => parseCard(card) ?? []) }];
    }),
  };
}

const raceStatuses: RaceStatus[] = ['open', 'locked', 'countdown', 'running', 'finished', 'cancelled'];

function modifiersOf(value: unknown): RaceModifiers | null {
  const row = rowOf(value);
  const energy = num(row.energy);
  const mood = num(row.mood);
  if (energy == null || mood == null) {
    return null;
  }
  return {
    energy,
    mood,
    stamina: num(row.stamina) ?? 0,
    agility: num(row.agility) ?? 0,
    intelligence: num(row.intelligence) ?? 0,
  };
}

function lookOf(value: unknown): Look | null {
  const row = rowOf(value);
  const coat = text(row.coat);
  if (!coat) return null;
  const look: Look = { coat };
  if (row.pattern === 'stripes' || row.pattern === 'points' || row.pattern === 'bicolor' || row.pattern === 'none') {
    look.pattern = row.pattern;
  }
  const accent = text(row.accent);
  if (accent) look.accent = accent;
  const eyeColor = text(row.eyeColor);
  if (eyeColor) look.eyeColor = eyeColor;
  return look;
}

function equippedOf(value: unknown): Equipped | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [slot, id] of Object.entries(value as Row)) {
    if (typeof id === 'string' && id) out[slot] = id;
  }
  return out as Equipped;
}

function lineupRow(value: unknown, index: number, npc: boolean): LineupRow {
  const item = rowOf(value);
  const coat = rowOf(item.coat);
  const detail = rowOf(item.detail);
  const ageDays = num(item.age_days);
  return {
    key: text(item.entry_id) ?? `${npc ? 'npc' : 'player'}-${index}`,
    lane: num(item.lane) ?? index + 1,
    petName: text(item.pet_name) ?? text(item.name) ?? 'Pet',
    species: speciesOf(item.species),
    level: num(item.pet_level),
    handle: text(item.handle),
    checkedIn: item.status === 'checked_in' || item.status === 'finished' || npc,
    mine: item.mine === true,
    npc,
    skill: num(item.skill),
    modifiers: modifiersOf(item.modifiers),
    finishMs: num(item.finish_ms),
    place: num(item.place),
    coat: text(coat.coat),
    breedId: text(item.breed_id),
    look: npc ? null : lookOf(item.look),
    equipped: npc ? null : equippedOf(item.equipped),
    ageDays: npc || ageDays == null || ageDays < 0 ? null : ageDays,
    scoreDm: num(item.score_dm),
    attemptsM: Array.isArray(detail.attempts_m) ? detail.attempts_m.flatMap((m) => num(m) ?? []) : [],
    bestAttempt: num(detail.best_attempt),
  };
}

export function parseRace(value: unknown): RaceView | null {
  const row = rowOf(value);
  const raceId = text(row.race_id);
  const startsAt = time(row.starts_at);
  if (!raceId || startsAt == null || !isRaceEvent(row.event_type)) {
    return null;
  }
  const entries = Array.isArray(row.entries) ? row.entries : [];
  const legacyNpcs = Array.isArray(row.npcs) ? row.npcs : [];
  const rows = entries.map((entry, index) => lineupRow(entry, index, rowOf(entry).is_npc === true));
  const npcRows = rows.filter((entry) => entry.npc);
  return {
    raceId,
    status: raceStatuses.includes(row.status as RaceStatus) ? (row.status as RaceStatus) : 'open',
    classId: isRaceClass(row.class) ? row.class : 'beginner',
    event: row.event_type,
    cup: cupOf(row.cup),
    startsAt,
    seed: text(row.seed) ?? '',
    configVersion: text(row.config_version) ?? 'funrun-1',
    players: rows.filter((entry) => !entry.npc),
    npcs: npcRows.length > 0 ? npcRows : legacyNpcs.map((entry, index) => lineupRow(entry, index, true)),
  };
}

export async function call(fn: string, args: Record<string, unknown>): Promise<StadiumResult<unknown>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, offline: true, reason: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      const message = error.message ?? '';
      return { ok: false, offline: offlinePattern.test(message), reason: message };
    }
    const serverNow = time(rowOf(data).server_now);
    if (serverNow != null) {
      noteServerTime(serverNow);
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, offline: true, reason: error instanceof Error ? error.message : 'offline' };
  }
}

export async function fetchBoard(petId: string): Promise<StadiumResult<StadiumBoard>> {
  kick(true);
  const result = await call('get_upcoming_slots', { p_pet_id: petId });
  return result.ok ? { ok: true, data: parseBoard(result.data) } : result;
}

export async function signUpFor(petId: string, eventId: string): Promise<StadiumResult<RaceSignup>> {
  const result = await call('sign_up', { p_pet_id: petId, p_event_id: eventId });
  if (!result.ok) {
    return result;
  }
  const entry = parseEntry(result.data);
  return entry ? { ok: true, data: entry } : { ok: false, offline: false, reason: 'bad entry' };
}

export async function withdrawEntry(entryId: string): Promise<StadiumResult<boolean>> {
  const result = await call('withdraw', { p_entry_id: entryId });
  return result.ok ? { ok: true, data: result.data === true } : result;
}

export async function gateHeartbeat(entryId: string): Promise<StadiumResult<RaceView>> {
  const result = await call('gate_heartbeat', { p_entry_id: entryId });
  if (!result.ok) {
    return result;
  }
  const race = parseRace(result.data);
  return race ? { ok: true, data: race } : { ok: false, offline: false, reason: 'bad race' };
}

// A non-2xx reply only says "non-2xx status code"; the server's own message is in the body.
async function functionErrorReason(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return fallback;
  try {
    const body = rowOf(await context.clone().json());
    return typeof body.error === 'string' ? `${context.status} ${body.error}` : `${context.status} ${fallback}`;
  } catch {
    return `${context.status} ${fallback}`;
  }
}

export async function submitRaceReport(
  raceId: string,
  claimedFinishMs: number | null,
  inputLog: RaceReportInputLog,
  claimedScoreDm?: number | null,
): Promise<StadiumResult<RaceView>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, offline: true, reason: 'offline' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('race_report', {
      body: {
        raceId,
        claimedFinishMs: claimedFinishMs == null ? null : Math.round(claimedFinishMs),
        inputLog,
        ...(claimedScoreDm == null ? {} : { claimedScoreDm: Math.round(claimedScoreDm) }),
      },
    });
    if (error) {
      const message = error.message ?? '';
      if (offlinePattern.test(message)) {
        return { ok: false, offline: true, reason: message };
      }
      const reason = await functionErrorReason(error, message);
      Sentry.captureMessage('race_report rejected', { level: 'warning', extra: { raceId, reason } });
      return { ok: false, offline: false, reason };
    }
    const payload = rowOf(data);
    if (typeof payload.error === 'string') {
      return { ok: false, offline: false, reason: payload.error };
    }
    const serverNow = time(payload.server_now);
    if (serverNow != null) {
      noteServerTime(serverNow);
    }
    const race = parseRace(data);
    return race ? { ok: true, data: race } : { ok: false, offline: false, reason: 'bad race' };
  } catch (error) {
    return { ok: false, offline: true, reason: error instanceof Error ? error.message : 'offline' };
  }
}

export async function fetchRace(raceId: string): Promise<StadiumResult<RaceView>> {
  const result = await call('race_state', { p_race_id: raceId });
  if (!result.ok) {
    return result;
  }
  const race = parseRace(result.data);
  return race ? { ok: true, data: race } : { ok: false, offline: false, reason: 'bad race' };
}
