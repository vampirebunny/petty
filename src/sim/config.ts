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

// A sitting should change a caption within minutes, and a real "please help" state
// (hunger above 75, energy below 20) should land in roughly 1.5–2.5 hours.
export const decayPerHour: { awake: Needs; asleep: Needs } = {
  awake: { hunger: 40, energy: -24, happiness: -36 },
  asleep: { hunger: 12, energy: 120, happiness: -8 },
};

export const highHungerThreshold = 75;
export const lowEnergyThreshold = 20;
// Extra on top of awake happiness decay while tummy or energy is below moodNeedFloor.
// Together this is -720/hour, about 12 mood points a minute.
export const extraHappinessDecayPerHour = -684;
// Tummy (100 - hunger) and energy must both be at least this for mood to rise.
// Below this on either ring, awake mood starts draining.
export const moodNeedFloor = 30;
// A throw or fetch. Uses the same diminishing curve as a stroke.
export const playHappinessGain = 10;
// Empty energy drops the pet for this long, then they wake with a little energy back.
export const collapseSleepSec = 5;
export const collapseWakeEnergy = 10;

export const wakeAtEnergy = 100;

export const feedHungerDrop = 40;

export const waterDrainPerDrink = 0.1;
export const waterEmptyGraceMs = 3 * 60 * 60 * 1000;
export const startingWaterLevel = 1;
// Hidden 0–100 need. Not shown on the rings. Drinking brings it down.
export const startingThirst = 15;
export const drinkThirstDrop = 50;
export const startingToys = ['ball'] as const;

export const treatHungerDrop = 10;
export const treatWeightGain = 0.04;
export const treatDailyCap = 3;

export const petHappinessGain = 6;
// A continuous cuddle stroke of this long pays a flat mood burst.
export const cuddleMoodHoldSec = 5;
export const cuddleMoodGain = 5;
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
// Weight lost per hour while the user plays (fetch). One minute cancels one meal.
// Sprint burn still applies on top above weightRunSpeed.
export const playWeightPerHour = 7.2;
// Extra share of play burn when overweight, so a heavy pet still slims down by exercising.
export const overweightPlayWeightBonus = 0.5;
// Extra need-energy spent per hour while busy. Five minutes of play spends as much as one meal of tummy.
export const activityEnergyPerHour = { walk: 336, trot: 672, canter: 1680, gallop: 3360, play: 480 } as const;
// Extra hunger per hour on top of the awake clock. Five minutes of play empties one meal.
export const activityHungerPerHour = { walk: 336, trot: 576, canter: 864, gallop: 1320, play: 480 } as const;
// Extra hidden thirst per hour while busy. Drinking is how this comes back down.
export const activityThirstPerHour = { walk: 50, trot: 80, canter: 120, gallop: 180, play: 70 } as const;
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
