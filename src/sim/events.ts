import { clampDrift, grantFlatAttributes, maturityOf, withDerived } from './attributes';
import { applyMeal } from './care';
import {
  clampMax,
  clampMin,
  feedDietGain,
  feedHungerDrop,
  feedStaminaDrift,
  feedXp,
  petAffectionDrift,
  petAttentionGain,
  petHappinessGain,
  petPurrAtOrAbove,
  petXp,
  startingWaterLevel,
  waterDrainPerDrink,
} from './config';
import { nextRng } from './rng';
import type { CareSample, Cue, PetEvent, PetState } from './types';

export type EventResult = {
  state: PetState;
  cue: Cue;
};

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function copyState(state: PetState): PetState {
  return {
    ...state,
    needs: { ...state.needs },
    careWindow: state.careWindow.map((sample) => ({ ...sample })),
    equipped: { ...state.equipped },
    look: { ...state.look },
    attributes: {
      ...state.attributes,
      potential: { ...state.attributes.potential },
      current: { ...state.attributes.current },
    },
    drift: { ...state.drift },
    toys: [...state.toys],
    treats: state.treats.map((stack) => ({ ...stack })),
    treatDay: { ...state.treatDay },
    boosts: state.boosts.map((boost) => ({ ...boost })),
  };
}

function bumpDiet(samples: CareSample[]): CareSample[] {
  const next = samples.map((sample) => ({ ...sample }));
  const today = next[next.length - 1];
  if (today == null) {
    return [
      {
        day: 0,
        dietQuality: Math.min(1, feedDietGain),
        exercise: 0,
        play: 0,
        attention: 0,
      },
    ];
  }
  today.dietQuality = Math.min(1, today.dietQuality + feedDietGain);
  return next;
}

function bumpAttention(samples: CareSample[]): CareSample[] {
  const next = samples.map((sample) => ({ ...sample }));
  const today = next[next.length - 1];
  if (today == null) {
    return next;
  }
  today.attention = Math.min(1, today.attention + petAttentionGain);
  return next;
}

export function applyEvent(state: PetState, event: PetEvent): EventResult {
  if (event.type === 'setScene') {
    const next = copyState(state);
    next.sceneId = event.sceneId;
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'equip') {
    const next = copyState(state);
    if (event.itemId == null || event.itemId === 'none') {
      delete next.equipped[event.slot];
    } else {
      next.equipped[event.slot] = event.itemId;
    }
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'idle') {
    const next = copyState(state);
    next.asleep = false;
    return { state: next, cue: { kind: 'idle' } };
  }

  if (event.type === 'sit' || event.type === 'paw' || event.type === 'speak') {
    const next = copyState(state);
    next.asleep = false;
    return { state: next, cue: { kind: event.type } };
  }

  if (event.type === 'feed') {
    const next = copyState(state);
    next.asleep = false;
    if (next.needs.hunger <= 0) {
      return { state: next, cue: { kind: 'refuse' } };
    }
    next.needs.hunger = clampNeed(next.needs.hunger - feedHungerDrop);
    next.xp += feedXp;
    next.drift.stamina = clampDrift(next.drift.stamina + feedStaminaDrift);
    next.careWindow = bumpDiet(next.careWindow);
    next.weight = applyMeal(next.weight);
    return { state: withDerived(next), cue: { kind: 'eat' } };
  }

  if (event.type === 'refillWater') {
    const next = copyState(state);
    next.waterLevel = startingWaterLevel;
    next.waterEmptySince = null;
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'drank') {
    const next = copyState(state);
    if (!event.fromBowl) {
      return { state: next, cue: { kind: 'none' } };
    }
    next.waterLevel = Math.max(0, next.waterLevel - waterDrainPerDrink);
    if (next.waterLevel <= 0) {
      next.waterLevel = 0;
      if (next.waterEmptySince == null) {
        next.waterEmptySince = event.now;
      }
    }
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'toggleRest') {
    const next = copyState(state);
    next.asleep = !state.asleep;
    return { state: next, cue: { kind: next.asleep ? 'yawn' : 'none' } };
  }

  // Cuddle mode starting only wakes the pet. The view runs the task itself, so there is no cue.
  if (event.type === 'cuddleStart') {
    const next = copyState(state);
    next.asleep = false;
    return { state: next, cue: { kind: 'none' } };
  }

  // A finished cuddle with real petting in it. Longer cuddles count for more, up to double a quick stroke.
  if (event.type === 'cuddled') {
    const next = copyState(state);
    const weight = 1 + Math.min(1, Math.max(0, event.seconds) / 20);
    next.needs.happiness = clampNeed(
      next.needs.happiness + petHappinessGain * weight * (1 - next.needs.happiness / clampMax),
    );
    next.xp += petXp;
    next.drift.affection = clampDrift(next.drift.affection + petAffectionDrift * weight);
    next.careWindow = bumpAttention(next.careWindow);
    return { state: withDerived(next), cue: { kind: 'none' } };
  }

  if (event.type === 'playdate') {
    const next = copyState(state);
    next.needs.happiness = clampNeed(next.needs.happiness + event.happiness);
    next.attributes.current = grantFlatAttributes(
      next.attributes.current,
      next.attributes.potential,
      maturityOf(next.ageDays),
      event.attributes,
    );
    return { state: withDerived(next), cue: { kind: 'none' } };
  }

  if (event.type === 'fetch') {
    const next = copyState(state);
    next.asleep = false;
    return { state: next, cue: { kind: 'fetch', drop: event.drop, flick: event.flick } };
  }

  const rng = nextRng(state.rngState);
  const next = copyState(state);
  next.asleep = false;
  next.rngState = rng.state;
  next.needs.happiness = clampNeed(
    next.needs.happiness + petHappinessGain * (1 - next.needs.happiness / clampMax),
  );
  next.xp += petXp;
  next.drift.affection = clampDrift(next.drift.affection + petAffectionDrift);
  next.careWindow = bumpAttention(next.careWindow);
  return {
    state: withDerived(next),
    cue: { kind: rng.value >= petPurrAtOrAbove ? 'purr' : 'wiggle' },
  };
}
