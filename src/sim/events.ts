import {
  clampMax,
  clampMin,
  feedFullnessGain,
  petHappinessGain,
  petPurrAtOrAbove,
} from './config';
import { nextRng } from './rng';
import type { Cue, PetEvent, PetState } from './types';

export type EventResult = {
  state: PetState;
  cue: Cue;
};

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function copyState(state: PetState, needs = state.needs): PetState {
  return {
    ...state,
    needs: { ...needs },
  };
}

export function applyEvent(state: PetState, event: PetEvent): EventResult {
  if (event.type === 'feed') {
    if (state.asleep) {
      return { state: copyState(state), cue: { kind: 'stir' } };
    }
    return {
      state: copyState(state, {
        ...state.needs,
        fullness: clampNeed(state.needs.fullness + feedFullnessGain),
      }),
      cue: { kind: 'eat' },
    };
  }

  if (event.type === 'toggleRest') {
    const asleep = !state.asleep;
    return {
      state: { ...copyState(state), asleep },
      cue: { kind: asleep ? 'yawn' : 'none' },
    };
  }

  if (state.asleep) {
    return { state: copyState(state), cue: { kind: 'stir' } };
  }

  const rng = nextRng(state.rngState);
  const gain = petHappinessGain * (1 - state.needs.happiness / clampMax);
  return {
    state: copyState(
      { ...state, rngState: rng.state },
      {
        ...state.needs,
        happiness: clampNeed(state.needs.happiness + gain),
      },
    ),
    cue: { kind: rng.value >= petPurrAtOrAbove ? 'purr' : 'wiggle' },
  };
}
