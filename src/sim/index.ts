export { advance, advanceNeeds } from './advance';
export { createLitter, createPet } from './createPet';
export { deriveMood } from './mood';
export { applyEvent } from './events';
export type { EventResult } from './events';
export {
  attributeScore,
  currentScores,
  maturityOf,
  naturalGrowth,
  potentialOf,
  potentialTotal,
  stageOf,
  temperamentOf,
  trainingGain,
} from './attributes';
export { ageDaysAt, applyWeightDelta, debugJump, resume, setAgeDays, setVitality, setWeight, tickForeground } from './clock';
export { applyCareTime, applyMeal, clampWeight, decayWeight, vitalityTarget } from './care';
export {
  clampMax,
  clampMin,
  decayPerHour,
  extraHappinessDecayPerHour,
  feedFullnessGain,
  happyHappinessAtLeast,
  lowEnergyThreshold,
  lowFullnessThreshold,
  maxElapsedMs,
  openTickMs,
  petHappinessGain,
  petPurrAtOrAbove,
  petStrokeIntervalMs,
  sadHappinessBelow,
  startingAsleep,
  startingNeeds,
  defaultSceneId,
  startingWeight,
  weightMealGain,
  stepMs,
  traits,
  wakeAtEnergy,
  daysToSenior,
  dayMs,
} from './config';
export { nextRng } from './rng';
export type { RngStep } from './rng';
export type {
  Cue,
  Equipped,
  LitterMate,
  OutfitSlot,
  Mood,
  Needs,
  PetEvent,
  PetState,
  SeniorBand,
  Stage,
  Stats,
  Temperament,
  Trait,
  Variant,
} from './types';
