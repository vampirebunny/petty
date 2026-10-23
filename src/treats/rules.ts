import { careConfig } from '../sim/careConfig';
import { applyEffects } from '../sim/effects';
import type { Effects } from '../sim/effects';
import type { PetState } from '../sim/types';
import { catalogItem } from '../economy/catalog';
import { reactionForTreat, treatById } from './kinds';

export type TreatResult =
  | { ok: true; state: PetState; reaction: string }
  | { ok: false; reason: 'unknown' | 'full' | 'energy_full' | 'mood_full' | 'species' };

export function canGiveTreat(state: PetState, treatId: string): TreatResult {
  const item = catalogItem(treatId);
  const kind = treatById(treatId);
  if (!item || !kind) {
    return { ok: false, reason: 'unknown' };
  }
  if (item.effects?.fill === 'energy' && state.needs.energy >= 95) {
    return { ok: false, reason: 'energy_full' };
  }
  if (item.effects?.fill === 'mood' && state.needs.happiness >= 95) {
    return { ok: false, reason: 'mood_full' };
  }
  if (item.effects?.fill == null && state.needs.hunger <= 0) {
    return { ok: false, reason: 'full' };
  }
  return { ok: true, state, reaction: reactionForTreat(treatId, state.breedId) };
}

// Interface only for training: fired when a treat follows a trick. No training behavior yet.
export type TreatRewardEvent = {
  type: 'treatReward';
  treatId: string;
  afterTrick: boolean;
  now: number;
};

export function giveTreat(state: PetState, treatId: string, now: number): TreatResult {
  const gate = canGiveTreat(state, treatId);
  if (!gate.ok) {
    return gate;
  }
  const kind = treatById(treatId)!;
  const item = catalogItem(treatId);
  let next = applyEffects(state, kind.effects, now);
  if (item?.effects?.fill === 'energy') {
    next = { ...next, needs: { ...next.needs, energy: 100 } };
  }
  if (item?.effects?.fill === 'mood') {
    next = { ...next, needs: { ...next.needs, happiness: 100 } };
  }
  return { ok: true, state: next, reaction: reactionForTreat(treatId, state.breedId) };
}

function scaled(effects: Effects, fraction: number): Effects {
  return {
    hunger: effects.hunger == null ? undefined : effects.hunger * fraction,
    weight: effects.weight == null ? undefined : effects.weight * fraction,
    mood: effects.mood == null ? undefined : effects.mood * fraction,
  };
}

// Reward treats skip the hunger gate. The calorie bite (hunger and weight) is smaller
// than a casual treat. Mood stays the full treat amount so a training reward feels the same.
export function applyRewardTreat(state: PetState, treatId: string, now: number): TreatResult {
  const kind = treatById(treatId);
  if (!kind) {
    return { ok: false, reason: 'unknown' };
  }
  const bite = scaled(kind.effects, careConfig.rewardCalorieFraction);
  const next = applyEffects(state, { ...bite, mood: kind.effects.mood }, now);
  return { ok: true, state: next, reaction: reactionForTreat(treatId, state.breedId) };
}

export function onTreatReward(state: PetState, treatId: string, now: number): TreatResult {
  return applyRewardTreat(state, treatId, now);
}
