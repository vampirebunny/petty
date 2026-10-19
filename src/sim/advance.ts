import {
  clampMax,
  clampMin,
  decayPerHour,
  extraHappinessDecayPerHour,
  highHungerThreshold,
  lowEnergyThreshold,
  maxElapsedMs,
  stepMs,
  wakeAtEnergy,
  waterEmptyGraceMs,
} from './config';
import { activeBoosts } from './effects';
import type { Needs, PetState } from './types';

const hourMs = 60 * 60 * 1000;

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function waterPenalty(state: PetState, stepNow: number): boolean {
  if (state.waterLevel > 0 || state.waterEmptySince == null) {
    return false;
  }
  return stepNow - state.waterEmptySince > waterEmptyGraceMs;
}

function applyStep(needs: Needs, asleep: boolean, emptyWater: boolean): Needs {
  const rates = asleep ? decayPerHour.asleep : decayPerHour.awake;
  const scale = stepMs / hourMs;
  let happiness = needs.happiness + rates.happiness * scale;
  if (
    !asleep &&
    (needs.hunger > highHungerThreshold || needs.energy < lowEnergyThreshold || emptyWater)
  ) {
    happiness += extraHappinessDecayPerHour * scale;
  }
  return {
    hunger: clampNeed(needs.hunger + rates.hunger * scale),
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
  let cursor = state.lastUpdatedAt;

  for (let i = 0; i < steps; i += 1) {
    cursor += stepMs;
    needs = applyStep(needs, asleep, waterPenalty(state, cursor));
    if (asleep && needs.energy >= wakeAtEnergy) {
      asleep = false;
    }
  }

  return {
    ...state,
    needs,
    asleep,
    lastUpdatedAt: state.lastUpdatedAt + steps * stepMs,
    boosts: activeBoosts(state.boosts, state.lastUpdatedAt + steps * stepMs),
  };
}

export function advance(state: PetState, elapsedMs: number): PetState {
  return advanceNeeds(state, elapsedMs, true);
}
