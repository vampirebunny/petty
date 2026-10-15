import type { Needs } from './types';

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
