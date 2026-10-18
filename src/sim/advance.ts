import {
  clampMax,
  clampMin,
  decayPerHour,
  extraHappinessDecayPerHour,
  lowEnergyThreshold,
  lowFullnessThreshold,
  maxElapsedMs,
  stepMs,
  wakeAtEnergy,
} from './config';
import type { Needs, PetState } from './types';

const hourMs = 60 * 60 * 1000;

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function applyStep(needs: Needs, asleep: boolean): Needs {
  const rates = asleep ? decayPerHour.asleep : decayPerHour.awake;
  const scale = stepMs / hourMs;
  let happiness = needs.happiness + rates.happiness * scale;
  if (
    !asleep &&
    (needs.fullness < lowFullnessThreshold || needs.energy < lowEnergyThreshold)
  ) {
    happiness += extraHappinessDecayPerHour * scale;
  }
  return {
    fullness: clampNeed(needs.fullness + rates.fullness * scale),
    energy: clampNeed(needs.energy + rates.energy * scale),
    happiness: clampNeed(happiness),
  };
}

export function advanceNeeds(state: PetState, elapsedMs: number, cap: boolean): PetState {
  const raw = Math.max(elapsedMs, 0);
  const elapsed = cap ? Math.min(raw, maxElapsedMs) : raw;
  const steps = Math.floor(elapsed / stepMs);
  let needs = { ...state.needs };
  let asleep = state.asleep;

  for (let i = 0; i < steps; i += 1) {
    needs = applyStep(needs, asleep);
    if (asleep && needs.energy >= wakeAtEnergy) {
      asleep = false;
    }
  }

  return {
    ...state,
    needs,
    asleep,
    lastUpdatedAt: state.lastUpdatedAt + steps * stepMs,
  };
}

export function advance(state: PetState, elapsedMs: number): PetState {
  return advanceNeeds(state, elapsedMs, true);
}
