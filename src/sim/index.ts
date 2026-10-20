export { advance, advanceNeeds } from './advance';
export { createPet } from './createPet';
export type { NewPet } from './createPet';
export { attributesFor, clampCurrent, currentStyle, generateOffers, startingCurrent, styleScores } from './offers';
export { canRaiseMood, deriveMood, needsMoodDrain, tummyOf } from './mood';
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
export { ageDaysAt, applyEnergyDelta, applyHappinessDelta, applyHungerDelta, applyThirstDelta, applyWeightDelta, debugJump, resume, setAgeDays, setVitality, setWeight, tickForeground } from './clock';
export { careConfig } from './careConfig';
export type { TreatTier, TrickTier } from './careConfig';
export { advanceCare, bathToleranceFor, ensureGame } from './game';
export { intelligenceFactor, payRep, petDayIndex, resolveReward, rewardCredit, rollTrick, successChance } from './training';
export { lockHint, speciesOf, trackDef, trackDefs, trackName, tracksFor } from './tracks';
export { applyCareTime, applyMeal, clampWeight, decayWeight, vitalityTarget } from './care';
export {
  clampMax,
  clampMin,
  collapseWakeEnergy,
  cuddleBellyMoodGain,
  cuddleMoodGain,
  cuddleMoodHoldSec,
  decayPerHour,
  extraHappinessDecayPerHour,
  feedEnergyGain,
  feedHungerDrop,
  happyHappinessAtLeast,
  highHungerThreshold,
  lowEnergyThreshold,
  maxElapsedMs,
  openTickMs,
  petHappinessGain,
  playHappinessGain,
  petPurrAtOrAbove,
  petStrokeIntervalMs,
  sadHappinessBelow,
  startingAsleep,
  startingNeeds,
  startingToys,
  startingWaterLevel,
  defaultSceneId,
  startingWeight,
  treatDailyCap,
  treatHungerDrop,
  treatWeightGain,
  waterDrainPerDrink,
  waterEmptyGraceMs,
  weightMealGain,
  stepMs,
  traits,
  archetypeNames,
  archetypeBlurbs,
  archetypeStyleNames,
  STYLE,
  archetypeStrong,
  archetypes,
  GEN,
  wakeAtEnergy,
  daysToSenior,
  dayMs,
} from './config';
export { applyEffects, activeBoosts, boostRemainingSec } from './effects';
export type { Effects } from './effects';
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
