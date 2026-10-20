import {
  clampMax,
  clampMin,
  decayPerHour,
  extraHappinessDecayPerHour,
  maxElapsedMs,
  stepMs,
  wakeAtEnergy,
  waterEmptyGraceMs,
} from './config';
import { activeBoosts } from './effects';
import { needsMoodDrain } from './mood';
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

function applyInterval(needs: Needs, asleep: boolean, emptyWater: boolean, durationMs: number): Needs {
  const rates = asleep ? decayPerHour.asleep : decayPerHour.awake;
  const scale = durationMs / hourMs;
  let happiness = needs.happiness;
  if (asleep) {
    happiness += rates.happiness * scale;
  } else if (needsMoodDrain(needs) || emptyWater) {
    happiness += rates.happiness * scale;
    happiness += extraHappinessDecayPerHour * scale;
  }
  return {
    hunger: clampNeed(needs.hunger + rates.hunger * scale),
    energy: clampNeed(needs.energy + rates.energy * scale),
    happiness: clampNeed(happiness),
  };
}

export function advanceNeedsDetail(
  state: PetState,
  elapsedMs: number,
  cap: boolean,
): { state: PetState; awakeMs: number } {
  const raw = Math.max(elapsedMs, 0);
  const elapsed = cap ? Math.min(raw, maxElapsedMs) : raw;
  const steps = Math.floor(elapsed / stepMs);
  const remainder = elapsed - steps * stepMs;
  let needs = { ...state.needs };
  let asleep = state.asleep;
  let awakeMs = 0;
  let cursor = state.lastUpdatedAt;

  const take = (durationMs: number) => {
    if (!asleep) {
      awakeMs += durationMs;
    }
    cursor += durationMs;
    needs = applyInterval(needs, asleep, waterPenalty(state, cursor), durationMs);
    if (asleep && needs.energy >= wakeAtEnergy) {
      asleep = false;
    }
  };

  for (let i = 0; i < steps; i += 1) {
    take(stepMs);
  }
  if (remainder > 0) {
    take(remainder);
  }

  const appliedThrough = state.lastUpdatedAt + elapsed;
  return {
    state: {
      ...state,
      needs,
      asleep,
      lastUpdatedAt: appliedThrough,
      boosts: activeBoosts(state.boosts, appliedThrough),
    },
    awakeMs,
  };
}

export function advanceNeeds(state: PetState, elapsedMs: number, cap: boolean): PetState {
  return advanceNeedsDetail(state, elapsedMs, cap).state;
}

export function advance(state: PetState, elapsedMs: number): PetState {
  return advanceNeeds(state, elapsedMs, true);
}
