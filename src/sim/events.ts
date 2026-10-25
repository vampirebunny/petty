import { addFlatTrained, clampDrift, withDerived } from './attributes';
import { applyMeal } from './care';
import {
  clampMax,
  clampMin,
  feedDietGain,
  feedEnergyGain,
  feedHungerDrop,
  feedStaminaDrift,
  feedXp,
  petAffectionDrift,
  petAttentionGain,
  petHappinessGain,
  petPurrAtOrAbove,
  petXp,
  drinkHydrationGain,
  startingWaterLevel,
  waterDrainPerDrink,
} from './config';
import { canRaiseMood } from './mood';
import { nextRng } from './rng';
import { rememberScene } from './game';
import { isResting, resolveReward, rollTrick } from './training';
import type { CareSample, Cue, PetCareState, PetEvent, PetState, TrainingTrack } from './types';

export type EventResult = {
  state: PetState;
  cue: Cue;
};

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function addHappiness(state: PetState, delta: number): void {
  if (delta <= 0 || !canRaiseMood(state.needs)) {
    return;
  }
  state.needs.happiness = clampNeed(state.needs.happiness + delta);
}

function copyCare(care: PetCareState): PetCareState {
  return {
    ...care,
    pendingReward: care.pendingReward ? { ...care.pendingReward } : null,
    recentScenes: [...care.recentScenes],
  };
}

function copyTraining(training: Record<string, TrainingTrack>): Record<string, TrainingTrack> {
  const next: Record<string, TrainingTrack> = {};
  for (const [id, track] of Object.entries(training)) {
    next[id] = { ...track };
  }
  return next;
}

function copyState(state: PetState): PetState {
  return {
    ...state,
    needs: { ...state.needs },
    care: copyCare(state.care),
    training: copyTraining(state.training),
    milestones: [...state.milestones],
    seenCoachMarks: [...state.seenCoachMarks],
    careWindow: state.careWindow.map((sample) => ({ ...sample })),
    equipped: { ...state.equipped },
    look: { ...state.look },
    attributes: {
      ...state.attributes,
      potential: { ...state.attributes.potential },
      current: { ...state.attributes.current },
      trained: state.attributes.trained ? { ...state.attributes.trained } : undefined,
    },
    drift: { ...state.drift },
    boosts: state.boosts.map((boost) => ({ ...boost })),
  };
}

function bumpDiet(samples: CareSample[], gain = feedDietGain): CareSample[] {
  const next = samples.map((sample) => ({ ...sample }));
  const today = next[next.length - 1];
  if (today == null) {
    return [
      {
        day: 0,
        dietQuality: Math.min(1, gain),
        exercise: 0,
        play: 0,
        attention: 0,
      },
    ];
  }
  today.dietQuality = Math.min(1, today.dietQuality + gain);
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
    const next = rememberScene(copyState(state), event.sceneId);
    next.sceneId = event.sceneId;
    if (next.care.pendingReward) {
      return { state: withDerived(resolveReward(next, state.lastUpdatedAt, 'none')), cue: { kind: 'none' } };
    }
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'trickRep') {
    const rolled = rollTrick(copyState(state), event.trackId, event.now);
    const track = rolled.state.training[event.trackId];
    if (!track?.unlocked || (isResting(track, event.now) && !rolled.state.care.pendingReward)) {
      return { state: withDerived(rolled.state), cue: { kind: 'none' } };
    }
    const catalogTrick = event.trackId !== 'sit' && event.trackId !== 'paw' && event.trackId !== 'speak';
    if (catalogTrick) {
      return { state: withDerived(rolled.state), cue: { kind: 'none' } };
    }
    const pose = event.trackId === 'paw' ? 'paw' : event.trackId === 'speak' ? 'speak' : 'sit';
    if (track.mastered && !rolled.state.care.pendingReward) {
      return { state: withDerived(rolled.state), cue: { kind: pose } };
    }
    return { state: withDerived(rolled.state), cue: { kind: rolled.ok ? pose : 'confused' } };
  }

  if (event.type === 'rewardTreat') {
    return { state: withDerived(resolveReward(copyState(state), event.now, event.choice)), cue: { kind: 'none' } };
  }

  if (event.type === 'seeCoach') {
    const next = copyState(state);
    if (!next.seenCoachMarks.includes(event.id)) {
      next.seenCoachMarks.push(event.id);
    }
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

  // Feed only fills the bowl, and only when it is empty. The pet goes to eat even when it is not hungry.
  if (event.type === 'feed') {
    if (state.foodInBowl) {
      return { state, cue: { kind: 'none' } };
    }
    const next = copyState(state);
    next.asleep = false;
    next.foodInBowl = true;
    next.bowlItemId = null;
    return { state: next, cue: { kind: 'eat' } };
  }

  // The pet finished the bowl: the meal lands now and the bowl is empty again.
  if (event.type === 'ate') {
    if (!state.foodInBowl) {
      return { state, cue: { kind: 'none' } };
    }
    const next = copyState(state);
    const meal = event.meal;
    next.foodInBowl = false;
    next.bowlItemId = null;
    if (meal?.fillTummy) {
      next.needs.hunger = 0;
    } else {
      next.needs.hunger = clampNeed(next.needs.hunger - feedHungerDrop * (meal?.hunger ?? 1));
    }
    next.needs.energy = clampNeed(next.needs.energy + feedEnergyGain * (meal?.energy ?? 1));
    next.xp += Math.round(feedXp * (meal?.xp ?? 1));
    next.drift.stamina = clampDrift(next.drift.stamina + feedStaminaDrift);
    next.careWindow = bumpDiet(next.careWindow, meal?.diet ?? feedDietGain);
    next.weight = applyMeal(next.weight, meal?.weight ?? 1);
    if (meal && meal.mood > 0) {
      addHappiness(next, meal.mood);
    }
    return { state: withDerived(next), cue: { kind: 'none' } };
  }

  if (event.type === 'refillWater') {
    const next = copyState(state);
    next.waterLevel = startingWaterLevel;
    next.waterEmptySince = null;
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'drank') {
    const next = copyState(state);
    next.hydration = clampNeed(next.hydration + drinkHydrationGain);
    if (!event.fromBowl) {
      return { state: next, cue: { kind: 'none' } };
    }
    next.waterLevel = Math.max(0, next.waterLevel - waterDrainPerDrink);
    if (next.waterLevel < 0.001) {
      next.waterLevel = 0;
    }
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

  // He has curled up. Asleep starts now, so energy ticks and the button can say Wake.
  if (event.type === 'beginRest') {
    if (state.asleep) {
      return { state, cue: { kind: 'none' } };
    }
    const next = copyState(state);
    next.asleep = true;
    return { state: next, cue: { kind: 'none' } };
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
    addHappiness(next, petHappinessGain * weight * (1 - next.needs.happiness / clampMax));
    next.xp += petXp;
    next.drift.affection = clampDrift(next.drift.affection + petAffectionDrift * weight);
    next.careWindow = bumpAttention(next.careWindow);
    return { state: withDerived(next), cue: { kind: 'none' } };
  }

  if (event.type === 'playdate') {
    const next = copyState(state);
    addHappiness(next, event.happiness);
    return { state: withDerived(addFlatTrained(next, event.attributes)), cue: { kind: 'none' } };
  }

  if (event.type === 'fetch') {
    const next = copyState(state);
    next.asleep = false;
    return { state: withDerived(next), cue: { kind: 'fetch', drop: event.drop, flick: event.flick } };
  }

  const rng = nextRng(state.rngState);
  const next = copyState(state);
  next.asleep = false;
  next.rngState = rng.state;
  addHappiness(next, petHappinessGain * (1 - next.needs.happiness / clampMax));
  next.xp += petXp;
  next.drift.affection = clampDrift(next.drift.affection + petAffectionDrift);
  next.careWindow = bumpAttention(next.careWindow);
  return {
    state: withDerived(next),
    cue: { kind: rng.value >= petPurrAtOrAbove ? 'purr' : 'wiggle' },
  };
}
