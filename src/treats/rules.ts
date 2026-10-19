import { dayMs, treatDailyCap } from '../sim/config';
import { applyEffects } from '../sim/effects';
import type { PetState } from '../sim/types';
import { treatById } from './kinds';

export type TreatResult =
  | { ok: true; state: PetState; reaction: string }
  | { ok: false; reason: 'unknown' | 'full' | 'cap' | 'species' };

function dayIndex(now: number, bornAt: number): number {
  return Math.floor(Math.max(0, now - bornAt) / dayMs);
}

export function canGiveTreat(state: PetState, treatId: string, now: number): TreatResult {
  const kind = treatById(treatId);
  if (!kind) {
    return { ok: false, reason: 'unknown' };
  }
  if (state.needs.hunger <= 0) {
    return { ok: false, reason: 'full' };
  }
  const day = dayIndex(now, state.bornAt);
  const count = state.treatDay.day === day ? state.treatDay.count : 0;
  if (count >= treatDailyCap) {
    return { ok: false, reason: 'cap' };
  }
  return { ok: true, state, reaction: kind.reaction };
}

// Interface only for training: fired when a treat follows a trick. No training behavior yet.
export type TreatRewardEvent = {
  type: 'treatReward';
  treatId: string;
  afterTrick: boolean;
  now: number;
};

export function giveTreat(state: PetState, treatId: string, now: number): TreatResult {
  const gate = canGiveTreat(state, treatId, now);
  if (!gate.ok) {
    return gate;
  }
  const kind = treatById(treatId)!;
  const day = dayIndex(now, state.bornAt);
  const count = state.treatDay.day === day ? state.treatDay.count : 0;
  let next = applyEffects(state, kind.effects, now);
  next = {
    ...next,
    treatDay: { day, count: count + 1 },
    treats: next.treats.map((stack) =>
      stack.treatId === treatId ? { ...stack, count: Math.max(0, stack.count - 1) } : stack,
    ),
  };
  return { ok: true, state: next, reaction: kind.reaction };
}

export function onTreatReward(_event: TreatRewardEvent): void {
  // Training hook placeholder.
}
