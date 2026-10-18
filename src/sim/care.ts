import { clampDrift, withDerived } from './attributes';
import {
  careWindowDays,
  dayMs,
  driftReturnPerDay,
  missedAttention,
  missedDietQuality,
  traits,
  vitalityFloor,
  vitalityMaxStepPerDay,
  weightCeil,
  weightDecayPerDay,
  weightFloor,
  weightMealGain,
} from './config';
import type { CareSample, PetState } from './types';

export function vitalityTarget(samples: CareSample[]): number {
  if (samples.length === 0) {
    return vitalityFloor;
  }
  const recent = samples.slice(-careWindowDays);
  const average =
    recent.reduce((sum, sample) => sum + (sample.dietQuality + sample.attention) / 2, 0) /
    recent.length;
  return Math.max(vitalityFloor, Math.min(1, average));
}

export function clampWeight(weight: number): number {
  return Math.max(weightFloor, Math.min(weightCeil, weight));
}

export function applyMeal(weight: number): number {
  return clampWeight(weight + weightMealGain);
}

export function decayWeight(weight: number, elapsedMs: number): number {
  const days = Math.max(0, elapsedMs) / dayMs;
  return clampWeight(weight - weightDecayPerDay * days);
}

function moveToward(current: number, target: number, maxStep: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxStep) {
    return target;
  }
  return current + Math.sign(delta) * maxStep;
}

function trim<T>(items: T[]): T[] {
  return items.slice(-careWindowDays);
}

export function applyCareTime(
  state: PetState,
  elapsedMs: number,
  absence: boolean,
  capMissedDays: boolean,
): PetState {
  const days = Math.max(0, elapsedMs) / dayMs;
  let careWindow = state.careWindow.map((sample) => ({ ...sample }));
  if (absence && days > 0) {
    const missed = Math.floor(days);
    const limited = capMissedDays ? Math.min(missed, 2) : missed;
    let day = careWindow.length > 0 ? careWindow[careWindow.length - 1].day : 0;
    for (let i = 0; i < limited; i += 1) {
      day += 1;
      careWindow.push({
        day,
        dietQuality: missedDietQuality,
        exercise: 0,
        play: 0,
        attention: missedAttention,
      });
    }
    careWindow = trim(careWindow);
  }

  const vitality = Math.max(
    vitalityFloor,
    moveToward(state.vitality, vitalityTarget(careWindow), vitalityMaxStepPerDay * days),
  );
  const drift = { ...state.drift };
  if (absence && days > 0) {
    for (const trait of traits) {
      drift[trait] = clampDrift(moveToward(drift[trait], 0, driftReturnPerDay * days));
    }
  }

  return withDerived({
    ...state,
    careWindow,
    vitality,
    drift,
  });
}
