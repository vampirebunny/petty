import type { Archetype, Needs, Trait } from './types';

export const startingNeeds: Needs = {
  hunger: 20,
  energy: 80,
  happiness: 80,
};

export const startingAsleep = false;

export const clampMin = 0;
export const clampMax = 100;

export const stepMs = 5 * 60 * 1000;
export const maxElapsedMs = 48 * 60 * 60 * 1000;

export const decayPerHour: { awake: Needs; asleep: Needs } = {
  awake: { hunger: 8, energy: -5, happiness: -3 },
  asleep: { hunger: 4, energy: 12, happiness: -1 },
};

export const highHungerThreshold = 75;
export const lowEnergyThreshold = 20;
export const extraHappinessDecayPerHour = -6;

export const wakeAtEnergy = 100;

export const feedHungerDrop = 25;

export const waterDrainPerDrink = 0.1;
export const waterEmptyGraceMs = 3 * 60 * 60 * 1000;
export const startingWaterLevel = 1;
export const startingToys = ['ball'] as const;

export const treatHungerDrop = 10;
export const treatWeightGain = 0.04;
export const treatDailyCap = 3;

export const petHappinessGain = 6;
export const petPurrAtOrAbove = 0.5;
export const petStrokeIntervalMs = 400;
export const openTickMs = 5000;

export const happyHappinessAtLeast = 70;
export const sadHappinessBelow = 30;

export const dayMs = 24 * 60 * 60 * 1000;
export const daysToSenior = 180;
export const visualLifespanDays = 1000;
export const careMultiplier = 1;
export const stageDayThresholds = [7, 21, 45, 180] as const;

export const traits: Trait[] = [
  'stamina',
  'agility',
  'intelligence',
  'boldness',
  'affection',
  'obedience',
];

export const archetypes: Archetype[] = ['athlete', 'thinker', 'charmer'];

// The two attributes each archetype is strong in. Strong is relative to the breed's range.
export const archetypeStrong: Record<Archetype, Trait[]> = {
  athlete: ['stamina', 'agility'],
  thinker: ['intelligence', 'obedience'],
  charmer: ['boldness', 'affection'],
};

export const archetypeNames: Record<Archetype, string> = {
  athlete: 'The Athlete',
  thinker: 'The Thinker',
  charmer: 'The Charmer',
};

// One-line description of each archetype, shown on the choose step.
export const archetypeBlurbs: Record<Archetype, string> = {
  athlete: 'Born to run. Fetch is life.',
  thinker: 'Learns tricks fast and listens well.',
  charmer: 'Never met a stranger. Loves everyone.',
};

// Label for the style a pet has grown into, shown next to the origin label when they differ.
export const archetypeStyleNames: Record<Archetype, string> = {
  athlete: 'Athletic',
  thinker: 'Clever',
  charmer: 'Charming',
};

// Another archetype becomes the current style only when it leads the origin by this much.
export const STYLE = { SWITCH_MARGIN: 0.05 };

// Attribute generation tuning. These are tuning numbers and will change.
export const GEN = {
  RULES_VERSION: 1,
  BASE_TOTAL: 375, // matches the breed midpoint sum
  QUALITY_SPREAD: 10, // per-pet total varies by this much either way
  JITTER: 0.15, // per-attribute individuality, shared by all three sets
  BOOST: 0.3, // how far strong attributes are pushed up the range
  START_FRACTION: 0.2, // current starts at this fraction of potential
};

export const puppyGrowthFraction = GEN.START_FRACTION;
export const adultGrowthFraction = 0.7;

export const careWindowDays = 7;
export const startingDietQuality = 0.75;
export const startingAttention = 0.75;
export const feedDietGain = 0.08;
export const petAttentionGain = 0.05;
export const missedDietQuality = 0.25;
export const missedAttention = 0.25;
export const vitalityFloor = 0.35;
export const vitalityMaxStepPerDay = 0.03;

export const startingWeight = 0;
export const weightFloor = -1;
export const weightCeil = 1;
export const weightMealGain = 0.12;
export const weightDecayPerDay = 0.12;
export const weightBurnPerSec = 0.003;
export const weightRunSpeed = 80;
export const healthyWeightBand = 0.25;
export const defaultSceneId = 'livingroom';

export const driftLimit = 2;
export const petAffectionDrift = 0.05;
export const feedStaminaDrift = 0.02;
export const driftReturnPerDay = 0.05;

export const feedXp = 5;
export const petXp = 2;
export const xpPerLevel = 25;

export const levelCeilingByStage = {
  puppy: 6,
  olderPuppy: 12,
  adolescent: 20,
  adult: 32,
  senior: 45,
} as const;

export const bandMargin = 0.05;
export const elderlyBelow = 0.4;
export const earlySeniorAbove = 0.7;

export const agingStaminaDrop = 0.25;
export const agingObedienceGain = 0.1;
export const weightModifierAtExtreme = 0.85;

export const dogBreedIds = ['retriever', 'corgi', 'dachshund', 'husky', 'pug'] as const;
