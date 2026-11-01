import { gameplayConfig } from './gameplayConfig';
import { trickListing } from './tricks';
import { speciesOf } from './tracks';
import type { PetState } from './types';

export type RaceEvent = 'funRun' | 'dockDive' | 'sniffOut' | 'trickShow' | 'hurdles' | 'weave' | 'obstacle' | 'meters800';
export type RaceClass = 'beginner' | 'novice' | 'open' | 'expert' | 'championship' | 'veteran';
export type RaceCup = 'open' | 'veteran' | 'friends';
export type SpeciesAllowed = 'dog' | 'cat' | 'both';
export type CardState = 'open' | 'entered' | 'busy' | 'resting' | 'missing_trick' | 'wrong_species' | 'closed';
export type GatePhase = 'waiting' | 'gate' | 'locked' | 'started';

export type RaceSignup = {
  entryId: string;
  raceId: string;
  eventId: string;
  event: RaceEvent;
  startsAt: number;
  classId: RaceClass;
  lane: number;
};

/** A friend game this pet has joined. Drives the same gate call and local reminder as a signup. */
export type FriendGameCall = {
  raceId: string;
  event: RaceEvent;
  startsAt: number;
};

export type RaceRecord = {
  /** Soonest upcoming signup. Older saves stored only this. */
  signup: RaceSignup | null;
  /** Every open signup. One per start time. Missing on saves from before that. */
  signups?: RaceSignup[];
  entered: boolean;
  friendGame?: FriendGameCall | null;
};

export type SkillBlock = {
  trickId: string;
  trickName: string;
};

const raceEvents: RaceEvent[] = ['funRun', 'dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle', 'meters800'];
const raceClasses: RaceClass[] = ['beginner', 'novice', 'open', 'expert', 'championship', 'veteran'];

const trickKeys: Partial<Record<RaceEvent, string[]>> = {
  trickShow: ['sit', 'speak', 'spin', 'stand_tall'],
  hurdles: ['hurdle'],
  weave: ['weave'],
  obstacle: ['hurdle', 'tunnel'],
};

const trickLabels: Record<string, string> = {
  sit: 'Sit',
  speak: 'Speak',
  spin: 'Spin',
  stand_tall: 'Stand Tall',
  hurdle: 'Jump the Hurdle',
  weave: 'Weave',
  tunnel: 'Through the Tunnel',
};

export function trickIdFor(species: 'dog' | 'cat', key: string): string {
  return key === 'sit' || key === 'speak' ? key : `${species}_${key}`;
}

export function isPlayableEvent(event: RaceEvent): boolean {
  return event === 'funRun' || event === 'hurdles' || event === 'dockDive' || event === 'obstacle' || event === 'meters800';
}

/** Fun Run and 800 Meters are one Open field. Every level races together. */
export function isOpenField(event: RaceEvent): boolean {
  return event === 'funRun' || event === 'meters800';
}

export function isRaceEvent(value: unknown): value is RaceEvent {
  return typeof value === 'string' && (raceEvents as string[]).includes(value);
}

export function isRaceClass(value: unknown): value is RaceClass {
  return typeof value === 'string' && (raceClasses as string[]).includes(value);
}

function friendGameOf(value: RaceRecord['friendGame']): FriendGameCall | null {
  if (!value || typeof value.raceId !== 'string' || !value.raceId) return null;
  if (!isRaceEvent(value.event) || typeof value.startsAt !== 'number' || !Number.isFinite(value.startsAt)) return null;
  return { raceId: value.raceId, event: value.event, startsAt: value.startsAt };
}

function signupOf(value: RaceSignup | null | undefined): RaceSignup | null {
  if (!value || typeof value.entryId !== 'string' || !value.entryId) return null;
  if (!isRaceEvent(value.event) || typeof value.startsAt !== 'number' || !Number.isFinite(value.startsAt)) return null;
  if (typeof value.raceId !== 'string' || typeof value.eventId !== 'string') return null;
  if (!isRaceClass(value.classId) || typeof value.lane !== 'number') return null;
  return value;
}

function signupsOf(record: RaceRecord): RaceSignup[] {
  const listed = Array.isArray(record.signups) ? record.signups.flatMap((row) => signupOf(row) ?? []) : [];
  if (listed.length > 0) {
    return listed.sort((a, b) => a.startsAt - b.startsAt);
  }
  const one = signupOf(record.signup);
  return one ? [one] : [];
}

export function racesOf(state: PetState): RaceRecord & { signups: RaceSignup[] } {
  const record = state.races;
  if (!record) {
    return { signup: null, signups: [], entered: false, friendGame: null };
  }
  const signups = signupsOf(record);
  return { signup: signups[0] ?? null, signups, entered: record.entered === true, friendGame: friendGameOf(record.friendGame) };
}

function sameSignup(a: RaceSignup, b: RaceSignup): boolean {
  return a.entryId === b.entryId && a.raceId === b.raceId && a.eventId === b.eventId && a.startsAt === b.startsAt && a.lane === b.lane && a.classId === b.classId && a.event === b.event;
}

function sameSignups(a: readonly RaceSignup[], b: readonly RaceSignup[]): boolean {
  return a.length === b.length && a.every((row, index) => sameSignup(row, b[index]!));
}

function storeSignups(state: PetState, signups: RaceSignup[]): PetState {
  const record = racesOf(state);
  const next = [...signups].sort((a, b) => a.startsAt - b.startsAt);
  if (sameSignups(record.signups, next)) return state;
  return {
    ...state,
    races: { ...record, signups: next, signup: next[0] ?? null },
  };
}

const eventLabels: Record<RaceEvent, string> = {
  funRun: 'Fun Run',
  dockDive: 'Dock Dive',
  sniffOut: 'Sniff Out',
  trickShow: 'Trick Show',
  hurdles: 'Hurdles',
  weave: 'Weave',
  obstacle: 'Obstacle Course',
  meters800: '800 Meters',
};

export function eventLabel(event: RaceEvent): string {
  return eventLabels[event];
}

export function eventTip(event: RaceEvent, name: string): string {
  if (isOpenField(event)) return `Tap as fast as you can to help ${name} run.`;
  return `${eventLabel(event)} is almost ready.`;
}

export function whoCanEnter(allowed: SpeciesAllowed): string {
  if (allowed === 'dog') return 'Dogs';
  if (allowed === 'cat') return 'Cats';
  return 'Dogs & cats';
}

export function classLabel(id: RaceClass): string {
  if (id === 'veteran') return 'Veteran Cup';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function raceTagLabel(race: { cup: RaceCup; classId: RaceClass }): string {
  return race.cup === 'friends' ? 'Friend game' : classLabel(race.classId);
}

export function trickNameFor(trickId: string): string {
  const key = trickId.replace(/^(dog|cat)_/, '');
  return trickListing(trickId)?.name ?? trickLabels[key] ?? trickId;
}

export function classForLevel(level: number): RaceClass {
  let found: RaceClass = 'beginner';
  for (const row of gameplayConfig.races.classes) {
    if (level >= row.level) {
      found = row.id as RaceClass;
    }
  }
  return found;
}

// Matches the server's stadium_event_class: Fun Run and 800 Meters are one Open field for every level.
export function classForEvent(event: RaceEvent, cup: RaceCup, levelClass: RaceClass): RaceClass {
  if (cup === 'veteran') return 'veteran';
  if (isOpenField(event)) return 'open';
  return levelClass;
}

export function formatSlot(start: number): string {
  return new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function gatePhase(startsAt: number, now: number): GatePhase {
  const { gateOpenMs, lockMs } = gameplayConfig.races;
  if (now >= startsAt) return 'started';
  if (now >= startsAt - lockMs) return 'locked';
  if (now >= startsAt - gateOpenMs) return 'gate';
  return 'waiting';
}

export function requiredTricks(event: RaceEvent, species: 'dog' | 'cat'): string[] {
  return (trickKeys[event] ?? []).map((key) => trickIdFor(species, key));
}

export function skillBlock(state: PetState, event: RaceEvent): SkillBlock | null {
  const species = speciesOf(state.breedId);
  for (const key of trickKeys[event] ?? []) {
    const trickId = trickIdFor(species, key);
    if (state.training[trickId]?.mastered) {
      continue;
    }
    const listing = trickListing(trickId);
    return {
      trickId,
      trickName: listing?.name ?? trickLabels[key] ?? eventLabel(event),
    };
  }
  return null;
}

export type RaceCall =
  | { kind: 'signup'; signup: RaceSignup; at: number }
  | { kind: 'friend'; call: FriendGameCall; at: number };

// The local notification asks the player back to the gate this long before the start.
export function upcomingRaceCall(state: PetState, now: number): RaceCall | null {
  const record = racesOf(state);
  const due: RaceCall[] = [];
  for (const signup of record.signups) {
    const at = signup.startsAt - gameplayConfig.races.callMs;
    if (at > now) due.push({ kind: 'signup', signup, at });
  }
  if (record.friendGame) {
    const at = record.friendGame.startsAt - gameplayConfig.races.callMs;
    if (at > now) due.push({ kind: 'friend', call: record.friendGame, at });
  }
  due.sort((a, b) => a.at - b.at);
  return due[0] ?? null;
}

export function raceReminderAt(state: PetState, now: number): number | null {
  return upcomingRaceCall(state, now)?.at ?? null;
}

export type SignedUpRace = {
  id: string;
  kind: 'signup' | 'friend';
  event: RaceEvent | null;
  startsAt: number | null;
  classId: RaceClass | null;
};

/** Public sign-ups and the friend game, soonest first. A board id wins over a stale local friend game. */
export function signedUpRaces(
  signups: readonly RaceSignup[],
  friend: FriendGameCall | null,
  friendRaceId: string | null,
): SignedUpRace[] {
  const rows: SignedUpRace[] = signups.map((signup) => ({
    id: signup.raceId,
    kind: 'signup' as const,
    event: signup.event,
    startsAt: signup.startsAt,
    classId: signup.classId,
  }));
  const friendId = friendRaceId ?? friend?.raceId ?? null;
  if (friendId && !signups.some((signup) => signup.raceId === friendId)) {
    const known = friend?.raceId === friendId ? friend : null;
    rows.push({
      id: friendId,
      kind: 'friend',
      event: known?.event ?? null,
      startsAt: known?.startsAt ?? null,
      classId: null,
    });
  }
  rows.sort((a, b) => (a.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.startsAt ?? Number.MAX_SAFE_INTEGER));
  return rows;
}

export function withSignup(state: PetState, signup: RaceSignup | null, _now: number): PetState {
  const record = racesOf(state);
  if (signup == null) {
    return record.signups.length === 0 ? state : storeSignups(state, []);
  }
  const kept = record.signups.filter((row) => row.entryId !== signup.entryId && row.startsAt !== signup.startsAt);
  return storeSignups(state, [...kept, signup]);
}

/** Drops one signup. The others, in later time slots, stay. */
export function withoutSignup(state: PetState, entryId: string): PetState {
  return storeSignups(state, racesOf(state).signups.filter((row) => row.entryId !== entryId));
}

export function replaceSignups(state: PetState, signups: readonly RaceSignup[]): PetState {
  return storeSignups(state, [...signups]);
}

export function withFriendGame(state: PetState, call: FriendGameCall | null, _now: number): PetState {
  const record = racesOf(state);
  if (call == null) {
    return record.friendGame == null ? state : { ...state, races: { ...record, friendGame: null } };
  }
  const current = record.friendGame;
  if (current?.raceId === call.raceId && current.event === call.event && current.startsAt === call.startsAt) {
    return state;
  }
  return { ...state, races: { ...record, friendGame: call } };
}

export function dropEndedSignup(state: PetState, now: number): PetState {
  const slot = gameplayConfig.races.slotMs;
  const record = racesOf(state);
  const signups = record.signups.filter((row) => now < row.startsAt + slot);
  let next = signups.length === record.signups.length ? state : storeSignups(state, signups);
  const friend = racesOf(next).friendGame;
  if (friend && now >= friend.startsAt + slot) {
    next = withFriendGame(next, null, now);
  }
  return next;
}
