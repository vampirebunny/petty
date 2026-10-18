import { clampDrift, withDerived } from './attributes';
import { applyMeal } from './care';
import {
  clampMax,
  clampMin,
  feedDietGain,
  feedFullnessGain,
  feedStaminaDrift,
  feedXp,
  petAffectionDrift,
  petAttentionGain,
  petHappinessGain,
  petPurrAtOrAbove,
  petXp,
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
    // Idle is the way back to the resting state: it cancels what the pet is doing and wakes a sleeper.
    const next = copyState(state);
    next.asleep = false;
    return { state: next, cue: { kind: 'idle' } };
  }

  if (event.type === 'sit' || event.type === 'paw' || event.type === 'speak') {
    // Showing a trick costs nothing. A sleeping pet only stirs.
    const next = copyState(state);
    return { state: next, cue: { kind: state.asleep ? 'stir' : event.type } };
  }

  if (event.type === 'feed' || event.type === 'drink') {
    if (state.asleep) {
      return { state: copyState(state), cue: { kind: 'stir' } };
    }
    const next = copyState(state);
    if (event.type === 'feed') {
      next.needs.fullness = clampNeed(next.needs.fullness + feedFullnessGain);
      next.xp += feedXp;
      next.drift.stamina = clampDrift(next.drift.stamina + feedStaminaDrift);
      next.careWindow = bumpDiet(next.careWindow);
      next.weight = applyMeal(next.weight);
      return { state: withDerived(next), cue: { kind: 'eat' } };
    }
    return { state: next, cue: { kind: 'drink' } };
  }

  if (event.type === 'toggleRest') {
    const next = copyState(state);
    next.asleep = !state.asleep;
    return { state: next, cue: { kind: next.asleep ? 'yawn' : 'none' } };
  }

  if (event.type === 'fetch') {
    if (state.asleep) {
      return { state: copyState(state), cue: { kind: 'stir' } };
    }
    return { state: copyState(state), cue: { kind: 'fetch', drop: event.drop } };
  }

  if (state.asleep) {
    return { state: copyState(state), cue: { kind: 'stir' } };
  }

  const rng = nextRng(state.rngState);
  const next = copyState(state);
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
