export { advance } from './advance';
export { createPet } from './createPet';
export { deriveMood } from './mood';
export { applyEvent } from './events';
export type { EventResult } from './events';
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
  stepMs,
  wakeAtEnergy,
} from './config';
export { nextRng } from './rng';
export type { RngStep } from './rng';
export type { Cue, Mood, Needs, PetEvent, PetState } from './types';
