import { stageOf } from './attributes';
import { gameplayConfig } from './gameplayConfig';
import { completeSuggestion } from './suggestions';
import { trickListing } from './tricks';
import { speciesOf } from './tracks';
import type { PetState, Stage } from './types';

export type RaceEvent = 'fetchSwat' | 'funRun' | 'hoopHop' | 'tunnelRun';
export type RaceClass = 'beginner' | 'novice' | 'open' | 'expert' | 'championship';
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

export type RaceRecord = {
  signup: RaceSignup | null;
  entered: boolean;
};

export type SkillBlock = {
  trickId: string;
  trickName: string;
  reason: 'now' | 'age';
  stageLabel: string;
};

const stageOrder: Stage[] = ['puppy', 'olderPuppy', 'adolescent', 'adult', 'senior'];

const stageLabels: Record<Stage, string> = {
  puppy: 'puppy',
  olderPuppy: 'older puppy',
  adolescent: 'adolescent',
  adult: 'adult',
  senior: 'senior',
};

const raceEvents: RaceEvent[] = ['fetchSwat', 'funRun', 'hoopHop', 'tunnelRun'];
const raceClasses: RaceClass[] = ['beginner', 'novice', 'open', 'expert', 'championship'];

const eventTrick: Partial<Record<RaceEvent, { dog: string; cat: string; label: string }>> = {
  hoopHop: { dog: 'dog_hoop', cat: 'cat_hoop', label: 'Jump Through Hoop' },
  tunnelRun: { dog: 'dog_tunnel', cat: 'cat_tunnel', label: 'Through the Tunnel' },
};

export function isRaceEvent(value: unknown): value is RaceEvent {
  return typeof value === 'string' && (raceEvents as string[]).includes(value);
}

export function isRaceClass(value: unknown): value is RaceClass {
  return typeof value === 'string' && (raceClasses as string[]).includes(value);
}

export function racesOf(state: PetState): RaceRecord {
  const record = state.races;
  if (!record) {
    return { signup: null, entered: false };
  }
  const signup = record.signup && typeof record.signup.entryId === 'string' ? record.signup : null;
  return { signup, entered: record.entered === true };
}

export function eventLabel(event: RaceEvent): string {
  if (event === 'fetchSwat') return 'Fetch & Swat';
  if (event === 'funRun') return 'Fun Run';
  if (event === 'hoopHop') return 'Hoop Hop';
  return 'Tunnel Run';
}

export function eventTip(event: RaceEvent, name: string): string {
  if (event === 'fetchSwat') return `Aim each throw so ${name} can catch it.`;
  if (event === 'funRun') return `Tap fast to help ${name} run.`;
  if (event === 'hoopHop') return `Tap right as ${name} reaches each hoop.`;
  return `Tap right as ${name} reaches each tunnel.`;
}

export function whoCanEnter(allowed: SpeciesAllowed): string {
  if (allowed === 'dog') return 'Dogs';
  if (allowed === 'cat') return 'Cats';
  return 'Dogs & cats';
}

export function classLabel(id: RaceClass): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
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

export function requiredTrick(event: RaceEvent, species: 'dog' | 'cat'): string | null {
  return eventTrick[event]?.[species] ?? null;
}

function stageReached(ageDays: number, need: Stage): boolean {
  return stageOrder.indexOf(stageOf(ageDays)) >= stageOrder.indexOf(need);
}

export function skillBlock(state: PetState, event: RaceEvent): SkillBlock | null {
  const trickId = requiredTrick(event, speciesOf(state.breedId));
  if (!trickId || state.training[trickId]?.mastered) {
    return null;
  }
  const listing = trickListing(trickId);
  const need = listing?.minAgeStage ?? 'adolescent';
  return {
    trickId,
    trickName: listing?.name ?? eventTrick[event]?.label ?? eventLabel(event),
    reason: stageReached(state.ageDays, need) ? 'now' : 'age',
    stageLabel: stageLabels[need],
  };
}

// The local notification fires when the gate opens.
export function raceReminderAt(state: PetState, now: number): number | null {
  const signup = racesOf(state).signup;
  if (!signup) {
    return null;
  }
  const at = signup.startsAt - gameplayConfig.races.gateOpenMs;
  return at > now ? at : null;
}

export function withSignup(state: PetState, signup: RaceSignup | null, now: number): PetState {
  const record = racesOf(state);
  if (signup == null) {
    return record.signup == null ? state : { ...state, races: { ...record, signup: null } };
  }
  if (record.signup?.entryId === signup.entryId && record.signup.startsAt === signup.startsAt) {
    return state;
  }
  const next: PetState = { ...state, races: { signup, entered: true } };
  return completeSuggestion(next, 'race', now);
}

export function dropEndedSignup(state: PetState, now: number): PetState {
  const signup = racesOf(state).signup;
  if (!signup || now < signup.startsAt + gameplayConfig.races.slotMs) {
    return state;
  }
  return withSignup(state, null, now);
}
