import { withDerived } from './attributes';
import { advanceNeeds, advanceNeedsDetail } from './advance';
import { applyCareTime, clampWeight, decayWeight } from './care';
import { dayMs, maxElapsedMs } from './config';
import { canRaiseMood } from './mood';
import { advanceCare } from './game';
import type { PetState } from './types';

export function ageDaysAt(bornAt: number, now: number): number {
  return Math.max(0, (now - bornAt) / dayMs);
}

function settle(state: PetState, now: number, needElapsed: number, weightElapsed: number, absence: boolean): PetState {
  const ageDays = ageDaysAt(state.bornAt, now);
  const stepped = advanceNeedsDetail({ ...state, ageDays }, needElapsed, true);
  const cared = applyCareTime(stepped.state, needElapsed, absence, true);
  const game = advanceCare(cared, now, needElapsed, stepped.awakeMs, absence ? 'away' : 'live');
  return withDerived({
    ...game,
    ageDays,
    weight: decayWeight(state.weight, weightElapsed),
    lastUpdatedAt: now,
    weightAppliedAt: now,
  });
}

export function tickForeground(state: PetState, now: number): PetState {
  const needElapsed = Math.min(Math.max(0, now - state.lastUpdatedAt), maxElapsedMs);
  const weightElapsed = Math.max(0, now - state.weightAppliedAt);
  return settle(state, now, needElapsed, weightElapsed, false);
}

export function resume(state: PetState, now: number): PetState {
  const needElapsed = Math.min(Math.max(0, now - state.lastUpdatedAt), maxElapsedMs);
  const weightElapsed = Math.max(0, now - state.weightAppliedAt);
  return settle(state, now, needElapsed, weightElapsed, needElapsed > 0);
}

export function debugJump(state: PetState, elapsedMs: number): PetState {
  const elapsed = Math.max(0, elapsedMs);
  const now = state.lastUpdatedAt + elapsed;
  const ageDays = state.ageDays + elapsed / dayMs;
  const jumped = {
    ...state,
    ageDays,
    bornAt: now - ageDays * dayMs,
  };
  const careElapsed = Math.min(elapsed, maxElapsedMs);
  const awake = advanceNeedsDetail(jumped, careElapsed, false).awakeMs;
  const needsNext = advanceNeeds(jumped, elapsed, false);
  const cared = applyCareTime(needsNext, elapsed, elapsed > 0, false);
  const game = advanceCare(cared, now, careElapsed, awake, elapsed > 0 ? 'away' : 'live');
  return withDerived({
    ...game,
    ageDays,
    bornAt: now - ageDays * dayMs,
    weight: decayWeight(state.weight, elapsed),
    lastUpdatedAt: now,
    weightAppliedAt: now,
  });
}

export function setAgeDays(state: PetState, ageDays: number): PetState {
  const days = Math.max(0, ageDays);
  return withDerived({
    ...state,
    ageDays: days,
    bornAt: state.lastUpdatedAt - days * dayMs,
  });
}

export function setVitality(state: PetState, vitality: number): PetState {
  return withDerived({
    ...state,
    vitality: Math.max(0, Math.min(1, vitality)),
  });
}

export function setWeight(state: PetState, weight: number): PetState {
  return withDerived({
    ...state,
    weight: clampWeight(weight),
  });
}

export function applyEnergyDelta(state: PetState, delta: number): PetState {
  if (delta === 0) {
    return state;
  }
  const energy = Math.max(0, Math.min(100, state.needs.energy + delta));
  if (energy === state.needs.energy) {
    return state;
  }
  return { ...state, needs: { ...state.needs, energy } };
}

export function applyHappinessDelta(state: PetState, delta: number): PetState {
  if (delta === 0) {
    return state;
  }
  if (delta > 0 && !canRaiseMood(state.needs)) {
    return state;
  }
  const happiness = Math.max(0, Math.min(100, state.needs.happiness + delta));
  if (happiness === state.needs.happiness) {
    return state;
  }
  return { ...state, needs: { ...state.needs, happiness } };
}

export function applyHungerDelta(state: PetState, delta: number): PetState {
  if (delta === 0) {
    return state;
  }
  const hunger = Math.max(0, Math.min(100, state.needs.hunger + delta));
  if (hunger === state.needs.hunger) {
    return state;
  }
  return { ...state, needs: { ...state.needs, hunger } };
}

export function applyThirstDelta(state: PetState, delta: number): PetState {
  if (delta === 0) {
    return state;
  }
  const thirst = Math.max(0, Math.min(100, state.thirst + delta));
  if (thirst === state.thirst) {
    return state;
  }
  return { ...state, thirst };
}

export function applyWeightDelta(state: PetState, delta: number): PetState {
  if (delta === 0) {
    return state;
  }
  return setWeight(state, state.weight + delta);
}
