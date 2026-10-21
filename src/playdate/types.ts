import type { Archetype, Equipped, Look, Stats, Trait } from '../sim/types';

export type Species = 'dog' | 'cat';

export type SnapshotSource = 'self' | 'npc' | 'rehomed' | 'friend';

export type PartyTrick = 'sit' | 'paw' | 'speak';

export type ActivityId =
  | 'fetch'
  | 'tug'
  | 'race'
  | 'chase'
  | 'hide'
  | 'sniff'
  | 'splash'
  | 'nap'
  | 'trick';

export type SpeciesPair = 'dog-dog' | 'cat-cat' | 'dog-cat';

export type BeatTemplateId =
  | 'fetch-dogs'
  | 'fetch-cross'
  | 'tug-dogs'
  | 'race-dogs'
  | 'race-cats'
  | 'race-cross'
  | 'chase-dogs'
  | 'chase-cats'
  | 'chase-cross'
  | 'hide-any'
  | 'sniff-any'
  | 'splash-dogs'
  | 'nap-any'
  | 'trick-any'
  | 'trick-cross';

export type PetSnapshot = {
  snapshotId: string;
  petId?: string;
  source: SnapshotSource;
  name: string;
  species: Species;
  breedId: string;
  look: Look;
  equipped: Equipped;
  ageDays: number;
  weight: number;
  vitality: number;
  seed: number;
  originArchetype: Archetype;
  currentStyle: Archetype;
  attributes: Stats;
  potential: Stats;
  favoriteActivities: ActivityId[];
  partyTricks: PartyTrick[];
  formerOwnerId?: string;
  bondAtSnapshot?: number;
  createdAt: string;
};

export type ActivityDefinition = {
  id: ActivityId;
  name: string;
  speciesPairs: SpeciesPair[];
  scenes: string[] | 'any';
  maxAgeStage?: 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';
  attributesTrained: Partial<Record<Trait, number>>;
  templates: Record<SpeciesPair, BeatTemplateId | null>;
};

// Where a beat sends a pet. Fixed points stay put. The rest follow the partner while the beat runs.
export type BeatToward = 'partner' | 'meet' | 'away';

export type BeatParams = {
  x?: number;
  y?: number;
  // 'partner' goes to the other pet, 'meet' stops halfway between, 'away' runs from them.
  toward?: BeatToward;
  // How close to stop, in multiples of the two bodies touching. 1 is nose to nose, 1.4 is a comfortable gap.
  gap?: number;
  // Fraction of the pet's top speed. Left out, the pose picks one.
  pace?: number;
  // Sideways shift in stage units, so two pets can circle or run in separate lanes.
  lane?: number;
  // Two pets sent to one point line up in x (default) or in y.
  spread?: 'x' | 'y';
};

export type BeatTempo = 'snap' | 'normal' | 'linger';

export type BeatProp = {
  kind: 'ball' | 'frisbee' | 'squeaky' | 'stick' | 'rope';
  holder?: 'A' | 'B' | 'both' | null;
  throwTo?: { x: number; y: number };
  at?: { x: number; y: number };
};

export type Beat = {
  t: number;
  actor: 'A' | 'B' | 'both';
  action: string;
  params?: BeatParams;
  // Set only when the step that produced this beat named them. Replay reads the stored values.
  emote?: string;
  fx?: string;
  sfx?: string;
  camera?: string;
  tag?: string;
  gesture?: string;
  prop?: BeatProp;
  tempo?: BeatTempo;
  holdBefore?: number;
  delay?: number;
};

export type RareEvent = { type: 'trick_shown'; trickId: PartyTrick } | { type: 'upset' };

export type PlaydateOutcome = {
  moodDelta: number;
  attributeXp: Partial<Record<Trait, number>>;
  bondDelta: number;
  rareEvents: RareEvent[];
};

export type PlaydateRecord = {
  version: 1 | 2;
  playdateId: string;
  ownerId: string;
  createdAt: string;
  sceneId: string;
  hour: number;
  petA: PetSnapshot;
  petB: PetSnapshot;
  activityId: ActivityId;
  outfit: Equipped;
  seed: number;
  beats: Beat[];
  outcome: PlaydateOutcome;
};

export type Relationship = {
  bond: number;
  playdateCount: number;
  lastPlaydateAt: string;
};

export type PlaydateSave = {
  /** 'month' means snapshot ages already use the 22-day senior calendar. */
  agingCalendar?: 'month';
  cast: PetSnapshot[];
  relationships: Record<string, Record<string, Relationship>>;
  history: PlaydateRecord[];
  lastPlaydateCompletedAt: number | null;
};
