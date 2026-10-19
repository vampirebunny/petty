export type Needs = {
  hunger: number;
  energy: number;
  happiness: number;
};

export type TreatStack = { treatId: string; count: number };

export type TreatDay = { day: number; count: number };

export type ActiveBoost = {
  attribute: string;
  multiplier: number;
  startAt: number;
  endAt: number;
};

export type Trait =
  | 'stamina'
  | 'agility'
  | 'intelligence'
  | 'boldness'
  | 'affection'
  | 'obedience';

export type Stats = Record<Trait, number>;

export type Range = [number, number];

export type BreedRanges = Record<Trait, Range>;

export type Archetype = 'athlete' | 'thinker' | 'charmer';

// Per-pet cosmetic look picked at adoption. Ears apply to dogs only.
export type Look = {
  coat: string;
  // A coat combination: stripes darken the coat, points put the accent on ears, legs, tail, and muzzle.
  // Omitted means the breed's own pattern.
  pattern?: 'stripes' | 'points' | 'bicolor' | 'none';
  accent?: string;
  // Optional eye color. Breeds with locked eyes ignore it.
  eyeColor?: string;
};

export type PetAttributes = {
  seed: number;
  rulesVersion: number;
  archetype: Archetype;
  potential: Stats;
  current: Stats;
};

export type AttributeSet = {
  archetype: Archetype;
  potential: Stats;
  current: Stats;
  total: number;
};

export type Stage = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';

export type SeniorBand = 'earlySenior' | 'senior' | 'elderly';

export type CareSample = {
  day: number;
  dietQuality: number;
  exercise: number;
  play: number;
  attention: number;
};

export type OutfitSlot = 'collar' | 'bandana' | 'glasses' | 'hat' | 'coat' | 'boots';

export type Equipped = Partial<Record<OutfitSlot, string>>;

export type PetState = {
  id: string;
  name: string;
  breedId: string;
  ageDays: number;
  maturity: number;
  vitality: number;
  careWindow: CareSample[];
  weight: number;
  weightAppliedAt: number;
  bornAt: number;
  sceneId: string;
  equipped: Equipped;
  look: Look;
  attributes: PetAttributes;
  drift: Stats;
  seniorBand?: SeniorBand;
  level: number;
  xp: number;
  bond: number;
  needs: Needs;
  asleep: boolean;
  lastUpdatedAt: number;
  rngState: number;
  waterLevel: number;
  waterEmptySince: number | null;
  toys: string[];
  treats: TreatStack[];
  treatDay: TreatDay;
  boosts: ActiveBoost[];
};

export type PetEvent =
  | { type: 'idle' }
  | { type: 'sit' }
  | { type: 'paw' }
  | { type: 'speak' }
  | { type: 'feed' }
  | { type: 'refillWater' }
  | { type: 'drank'; fromBowl: boolean; now: number }
  | { type: 'toggleRest' }
  | { type: 'pet' }
  | { type: 'cuddleStart' }
  | { type: 'cuddled'; seconds: number }
  | { type: 'fetch'; drop?: { x: number; y: number }; flick?: { vx: number; vy: number; vz: number } }
  | { type: 'setScene'; sceneId: string }
  | { type: 'equip'; slot: OutfitSlot; itemId: string | null };

export type Mood = 'happy' | 'content' | 'hungry' | 'sleepy' | 'sad' | 'sleeping';

export type Cue = {
  kind:
    | 'none'
    | 'idle'
    | 'sit'
    | 'paw'
    | 'speak'
    | 'eat'
    | 'refuse'
    | 'wiggle'
    | 'purr'
    | 'stir'
    | 'yawn'
    | 'fetch';
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
};