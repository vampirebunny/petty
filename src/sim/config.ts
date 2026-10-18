import type { Needs, Trait } from './types';

export const startingNeeds: Needs = {
  fullness: 80,
  energy: 80,
  happiness: 80,
};

export const startingAsleep = false;

export const clampMin = 0;
export const clampMax = 100;

export const stepMs = 5 * 60 * 1000;
export const maxElapsedMs = 48 * 60 * 60 * 1000;

export const decayPerHour: { awake: Needs; asleep: Needs } = {
  awake: { fullness: -8, energy: -5, happiness: -3 },
  asleep: { fullness: -4, energy: 12, happiness: -1 },
};

export const lowFullnessThreshold = 25;
export const lowEnergyThreshold = 20;
export const extraHappinessDecayPerHour = -6;

export const wakeAtEnergy = 100;

export const feedFullnessGain = 25;

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

export const basePotential = 12;
export const breedPotentialTotal = 72;
export const rollRange = 3;

export const temperamentByVariant = [
  { boosts: 'stamina', dampens: 'agility', label: 'steady pacer' },
  { boosts: 'intelligence', dampens: 'boldness', label: 'bright pupil' },
  { boosts: 'affection', dampens: 'obedience', label: 'soft heart' },
] as const;

export const puppyGrowthFraction = 0.25;
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
