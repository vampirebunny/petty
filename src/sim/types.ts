export type Needs = {
  fullness: number;
  energy: number;
  happiness: number;
};

export type Trait =
  | 'stamina'
  | 'agility'
  | 'intelligence'
  | 'boldness'
  | 'affection'
  | 'obedience';

export type Stats = Record<Trait, number>;

export type Stage = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';

export type SeniorBand = 'earlySenior' | 'senior' | 'elderly';

export type Variant = 0 | 1 | 2;

export type CareSample = {
  day: number;
  dietQuality: number;
  exercise: number;
  play: number;
  attention: number;
};

export type OutfitSlot = 'collar' | 'bandana' | 'glasses' | 'hat' | 'coat' | 'boots';

export type Equipped = Partial<Record<OutfitSlot, string>>;

export type Temperament = {
  boosts: Trait;
  dampens: Trait;
  label: string;
};

export type PetState = {
  id: string;
  seed: number;
  variant: Variant;
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
  potential: Stats;
  trained: Stats;
  temperament: Temperament;
  drift: Stats;
  seniorBand?: SeniorBand;
  level: number;
  xp: number;
  bond: number;
  needs: Needs;
  asleep: boolean;
  lastUpdatedAt: number;
  rngState: number;
};

export type PetEvent =
  | { type: 'feed' }
  | { type: 'drink' }
  | { type: 'toggleRest' }
  | { type: 'pet' }
  | { type: 'fetch'; drop?: { x: number; y: number } }
  | { type: 'setScene'; sceneId: string }
  | { type: 'equip'; slot: OutfitSlot; itemId: string | null };

export type Mood = 'happy' | 'content' | 'hungry' | 'sleepy' | 'sad' | 'sleeping';

export type Cue = {
  kind: 'none' | 'eat' | 'drink' | 'wiggle' | 'purr' | 'stir' | 'yawn' | 'fetch';
  drop?: { x: number; y: number };
};

export type LitterMate = {
  variant: Variant;
  breedId: string;
  temperament: Temperament;
  potential: Stats;
  current: Stats;
};
