import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';

export type { FurniturePiece, FurniturePlacement };

export type Needs = {
  hunger: number;
  energy: number;
  happiness: number;
};

export type TreatStack = { treatId: string; count: number };

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
  // Points above natural growth from training and playdates. Missing on a save means "not migrated yet".
  trained?: Stats;
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

export type OutfitSlot = 'hat' | 'glasses' | 'neckwear' | 'jacket' | 'boots';

export type Equipped = Partial<Record<OutfitSlot, string>>;

export type PendingReward = {
  trackId: string;
  openedAt: number;
};

export type PetCareState = {
  hygiene: number;
  lastBathAt: number | null;
  lastBrushAt: number | null;
  bathTolerance: number;
  bathToleranceStart: number;
  pendingReward: PendingReward | null;
  recentScenes: string[];
};

export type TrainingTrack = {
  id: string;
  progress: number;
  unlocked: boolean;
  mastered: boolean;
  focusUsed: number;
  restUntil: number | null;
  hadNoTreat: boolean;
  pendingPenalty: boolean;
  lastPracticedAt: number | null;
};

export type PetState = {
  id: string;
  /** Guest or account user id that owns this pet. Missing on pre-identity saves. */
  ownerId?: string;
  name: string;
  breedId: string;
  ageDays: number;
  /** 'month' means ageDays already uses the 22-day senior calendar. Missing means the 180-day calendar. */
  agingCalendar?: 'month';
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
  // True while the bowl holds food the pet has not eaten yet.
  foodInBowl: boolean;
  waterLevel: number;
  waterEmptySince: number | null;
  // 0–100. 100 is fully hydrated. Activity spends it; drinking raises it. Not part of the away clock.
  hydration: number;
  toys: string[];
  furniture: FurniturePiece[];
  furniturePlaced: FurniturePlacement[];
  treats: TreatStack[];
  boosts: ActiveBoost[];
  care: PetCareState;
  training: Record<string, TrainingTrack>;
  milestones: string[];
  seenCoachMarks: string[];
  // Second greeting of the last long combo. Shorts and closers are not stored.
  lastGreetingId?: string;
};

export type PetEvent =
  | { type: 'idle' }
  | { type: 'sit' }
  | { type: 'paw' }
  | { type: 'speak' }
  | { type: 'feed' }
  | { type: 'ate'; now: number }
  | { type: 'refillWater' }
  | { type: 'drank'; fromBowl: boolean; now: number }
  | { type: 'toggleRest' }
  | { type: 'pet' }
  | { type: 'cuddleStart' }
  | { type: 'cuddled'; seconds: number }
  | { type: 'fetch'; drop?: { x: number; y: number }; flick?: { vx: number; vy: number; vz: number } }
  | { type: 'setScene'; sceneId: string }
  | { type: 'equip'; slot: OutfitSlot; itemId: string | null }
  | { type: 'playdate'; happiness: number; attributes: Partial<Record<Trait, number>> }
  | { type: 'trickRep'; trackId: string; now: number }
  | { type: 'rewardTreat'; choice: 'treat' | 'none'; now: number }
  | { type: 'clearTreats' }
  | { type: 'seeCoach'; id: string }
  | { type: 'moveFurniture'; pieceId: string; sceneId: string; x: number; y: number };

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
    | 'fetch'
    | 'confused'
    | 'praise'
    | 'greet'
    | 'treat';
  treatId?: string;
  moodGain?: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
  elapsedH?: number;
};