import { getSupabase } from '../compliance/supabase';
import { noteServerTime } from '../db/accountMeta';
import { kick } from '../sync/queue';
import {
  isRaceClass,
  isRaceEvent,
  type CardState,
  type RaceClass,
  type RaceEvent,
  type RaceSignup,
  type SpeciesAllowed,
} from '../sim/stadium';

export type StadiumCard = {
  id: string;
  event: RaceEvent;
  speciesAllowed: SpeciesAllowed;
  requiredTrick: string | null;
  isAway: boolean;
  awayLocation: string | null;
  state: CardState;
  signedUp: number;
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
};

export type RaceStatus = 'open' | 'locked' | 'running' | 'finished' | 'cancelled';

export type RaceView = {
  raceId: string;
  status: RaceStatus;
  classId: RaceClass;
  event: RaceEvent;
  startsAt: number;
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
    requiredTrick: text(row.required_trick),
    isAway: row.is_away === true,
    awayLocation: text(row.away_location),
    state,
    signedUp: num(row.signed_up) ?? 0,
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

const raceStatuses: RaceStatus[] = ['open', 'locked', 'running', 'finished', 'cancelled'];

export function parseRace(value: unknown): RaceView | null {
  const row = rowOf(value);
  const raceId = text(row.race_id);
  const startsAt = time(row.starts_at);
  if (!raceId || startsAt == null || !isRaceEvent(row.event_type)) {
    return null;
  }
  const entries = Array.isArray(row.entries) ? row.entries : [];
  const npcs = Array.isArray(row.npcs) ? row.npcs : [];
  return {
    raceId,
    status: raceStatuses.includes(row.status as RaceStatus) ? (row.status as RaceStatus) : 'open',
    classId: isRaceClass(row.class) ? row.class : 'beginner',
    event: row.event_type,
    startsAt,
    players: entries.map((entry, index) => {
      const item = rowOf(entry);
      return {
        key: text(item.entry_id) ?? `player-${index}`,
        lane: num(item.lane) ?? index + 1,
        petName: text(item.pet_name) ?? 'Pet',
        species: speciesOf(item.species),
        level: num(item.pet_level),
        handle: text(item.handle),
        checkedIn: item.status === 'checked_in' || item.status === 'finished',
        mine: item.mine === true,
        npc: false,
      };
    }),
    npcs: npcs.map((entry, index) => {
      const item = rowOf(entry);
      return {
        key: `npc-${index}`,
        lane: num(item.lane) ?? index + 2,
        petName: text(item.name) ?? 'Pal',
        species: speciesOf(item.species),
        level: null,
        handle: null,
        checkedIn: true,
        mine: false,
        npc: true,
      };
    }),
  };
}

async function call(fn: string, args: Record<string, unknown>): Promise<StadiumResult<unknown>> {
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

export async function fetchRace(raceId: string): Promise<StadiumResult<RaceView>> {
  const result = await call('race_state', { p_race_id: raceId });
  if (!result.ok) {
    return result;
  }
  const race = parseRace(result.data);
  return race ? { ok: true, data: race } : { ok: false, offline: false, reason: 'bad race' };
}
