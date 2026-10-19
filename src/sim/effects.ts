import { clampDrift, withDerived } from './attributes';
import { clampWeight } from './care';
import { clampMax, clampMin, traits } from './config';
import type { ActiveBoost, PetState, Trait } from './types';

export type Effects = {
  weight?: number;
  mood?: number;
  hunger?: number;
  attributes?: Partial<Record<Trait, number>>;
  boost?: { attribute: string; multiplier: number; durationSec: number };
};

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

export function applyEffects(state: PetState, effects: Effects, now: number): PetState {
  const next = {
    ...state,
    needs: { ...state.needs },
    drift: { ...state.drift },
    boosts: state.boosts.map((boost) => ({ ...boost })),
  };

  if (effects.hunger != null) {
    next.needs.hunger = clampNeed(next.needs.hunger + effects.hunger);
  }
  if (effects.mood != null) {
    next.needs.happiness = clampNeed(next.needs.happiness + effects.mood);
  }
  if (effects.weight != null) {
    next.weight = clampWeight(next.weight + effects.weight);
  }
  if (effects.attributes) {
    for (const trait of traits) {
      const delta = effects.attributes[trait];
      if (delta != null) {
        next.drift[trait] = clampDrift(next.drift[trait] + delta);
      }
    }
  }
  if (effects.boost) {
    const boost: ActiveBoost = {
      attribute: effects.boost.attribute,
      multiplier: effects.boost.multiplier,
      startAt: now,
      endAt: now + effects.boost.durationSec * 1000,
    };
    next.boosts = [...next.boosts.filter((b) => b.endAt > now), boost];
  }

  return withDerived(next);
}

export function activeBoosts(boosts: ActiveBoost[], now: number): ActiveBoost[] {
  return boosts.filter((boost) => boost.endAt > now);
}

export function boostRemainingSec(boost: ActiveBoost, now: number): number {
  return Math.max(0, (boost.endAt - now) / 1000);
}
