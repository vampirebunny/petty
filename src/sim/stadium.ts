import { stageOf } from './attributes';
import { gameplayConfig } from './gameplayConfig';
import { trickListing } from './tricks';
import { speciesOf } from './tracks';
import type { PetState, Stage } from './types';

export type RaceEvent = 'funRun' | 'dockDive' | 'sniffOut' | 'trickShow' | 'hurdles' | 'weave' | 'obstacle';
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

const raceEvents: RaceEvent[] = ['funRun', 'dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle'];
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
  return event === 'funRun' || event === 'hurdles' || event === 'dockDive' || event === 'obstacle';
}

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

const eventLabels: Record<RaceEvent, string> = {
  funRun: 'Fun Run',
  dockDive: 'Dock Dive',
  sniffOut: 'Sniff Out',
  trickShow: 'Trick Show',
  hurdles: 'Hurdles',
  weave: 'Weave',
  obstacle: 'Obstacle Course',
};

export function eventLabel(event: RaceEvent): string {
  return eventLabels[event];
}

export function eventTip(event: RaceEvent, name: string): string {
  if (event === 'funRun') return `Tap as fast as you can to help ${name} run.`;
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

// Matches the server's stadium_event_class: Fun Run is one Open field for every level.
export function classForEvent(event: RaceEvent, cup: RaceCup, levelClass: RaceClass): RaceClass {
  if (cup === 'veteran') return 'veteran';
  if (event === 'funRun') return 'open';
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

function stageReached(ageDays: number, need: Stage): boolean {
  return stageOrder.indexOf(stageOf(ageDays)) >= stageOrder.indexOf(need);
}

export function skillBlock(state: PetState, event: RaceEvent): SkillBlock | null {
  const species = speciesOf(state.breedId);
  for (const key of trickKeys[event] ?? []) {
    const trickId = trickIdFor(species, key);
    if (state.training[trickId]?.mastered) {
      continue;
    }
    const listing = trickListing(trickId);
    const need = listing?.minAgeStage ?? 'adolescent';
    return {
      trickId,
      trickName: listing?.name ?? trickLabels[key] ?? eventLabel(event),
      reason: stageReached(state.ageDays, need) ? 'now' : 'age',
      stageLabel: stageLabels[need],
    };
  }
  return null;
}

// The local notification asks the player back to the gate this long before the start.
export function raceReminderAt(state: PetState, now: number): number | null {
  const signup = racesOf(state).signup;
  if (!signup) {
    return null;
  }
  const at = signup.startsAt - gameplayConfig.races.callMs;
  return at > now ? at : null;
}

export function withSignup(state: PetState, signup: RaceSignup | null, _now: number): PetState {
  const record = racesOf(state);
  if (signup == null) {
    return record.signup == null ? state : { ...state, races: { ...record, signup: null } };
  }
  if (record.signup?.entryId === signup.entryId && record.signup.startsAt === signup.startsAt) {
    return state;
  }
  return { ...state, races: { signup, entered: record.entered } };
}

export function dropEndedSignup(state: PetState, now: number): PetState {
  const signup = racesOf(state).signup;
  if (!signup || now < signup.startsAt + gameplayConfig.races.slotMs) {
    return state;
  }
  return withSignup(state, null, now);
}
