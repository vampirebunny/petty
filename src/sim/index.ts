export { advance, advanceNeeds } from './advance';
export { createPet } from './createPet';
export type { NewPet } from './createPet';
export { attributesFor, clampCurrent, generateOffers, startingCurrent } from './offers';
export { deriveMood } from './mood';
export { applyEvent } from './events';
export type { EventResult } from './events';
export {
  attributeScore,
  maturityOf,
  naturalGrowth,
  potentialTotal,
  stageOf,
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
  archetypeNames,
  archetypeStrong,
  archetypes,
  GEN,
  wakeAtEnergy,
  daysToSenior,
  dayMs,
} from './config';
export { nextRng } from './rng';
export type { RngStep } from './rng';
export type {
  Archetype,
  AttributeSet,
  BreedRanges,
  Cue,
  Equipped,
  Look,
  OutfitSlot,
  Mood,
  Needs,
  PetAttributes,
  PetEvent,
  PetState,
  Range,
  SeniorBand,
  Stage,
  Stats,
  Trait,
} from './types';
