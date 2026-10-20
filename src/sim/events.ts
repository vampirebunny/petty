import { clampDrift, grantFlatAttributes, maturityOf, withDerived } from './attributes';
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
  playHappinessGain,
  petPurrAtOrAbove,
  petXp,
  drinkThirstDrop,
  startingWaterLevel,
  waterDrainPerDrink,
} from './config';
import { canRaiseMood } from './mood';
import { nextRng } from './rng';
import { rememberScene } from './game';
import { resolveReward, rollTrick } from './training';
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
    unclaimed: { ...care.unclaimed },
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
    const next = rememberScene(copyState(state), event.sceneId);
    next.sceneId = event.sceneId;
    if (next.care.pendingReward) {
      return { state: withDerived(resolveReward(next, state.lastUpdatedAt, null)), cue: { kind: 'none' } };
    }
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'trickRep') {
    const rolled = rollTrick(copyState(state), event.trackId, event.now);
    const track = rolled.state.training[event.trackId];
    if (!track?.unlocked) {
      return { state, cue: { kind: 'none' } };
    }
    if (track.mastered && !rolled.state.care.pendingReward) {
      const cue = event.trackId === 'paw' ? 'paw' : event.trackId === 'speak' ? 'speak' : 'sit';
      return { state: withDerived(rolled.state), cue: { kind: cue } };
    }
    return { state: withDerived(rolled.state), cue: { kind: rolled.ok ? (event.trackId === 'paw' ? 'paw' : event.trackId === 'speak' ? 'speak' : 'sit') : 'confused' } };
  }

  if (event.type === 'rewardTreat') {
    return { state: withDerived(resolveReward(copyState(state), event.now, event.tier)), cue: { kind: 'none' } };
  }

  // A cuddle is worth a basic treat: same window, same credit, nothing to spend.
  if (event.type === 'rewardCuddle') {
    if (!state.care.pendingReward) {
      return { state, cue: { kind: 'none' } };
    }
    return { state: withDerived(resolveReward(copyState(state), event.now, 'basic')), cue: { kind: 'none' } };
  }

  if (event.type === 'claimGrants') {
    const next = copyState(state);
    next.care.unclaimed = { basic: 0, special: 0 };
    return { state: next, cue: { kind: 'none' } };
  }

  if (event.type === 'clearTreats') {
    const next = copyState(state);
    next.treats = [];
    return { state: next, cue: { kind: 'none' } };
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
    return { state: next, cue: { kind: 'eat' } };
  }

  // The pet finished the bowl: the meal lands now and the bowl is empty again.
  if (event.type === 'ate') {
    if (!state.foodInBowl) {
      return { state, cue: { kind: 'none' } };
    }
    const next = copyState(state);
    next.foodInBowl = false;
    next.needs.hunger = clampNeed(next.needs.hunger - feedHungerDrop);
    next.needs.energy = clampNeed(next.needs.energy + feedEnergyGain);
    next.xp += feedXp;
    next.drift.stamina = clampDrift(next.drift.stamina + feedStaminaDrift);
    next.careWindow = bumpDiet(next.careWindow);
    next.weight = applyMeal(next.weight);
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
    next.thirst = clampNeed(next.thirst - drinkThirstDrop);
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
    addHappiness(next, petHappinessGain * weight * (1 - next.needs.happiness / clampMax));
    next.xp += petXp;
    next.drift.affection = clampDrift(next.drift.affection + petAffectionDrift * weight);
    next.careWindow = bumpAttention(next.careWindow);
    return { state: withDerived(next), cue: { kind: 'none' } };
  }

  if (event.type === 'playdate') {
    const next = copyState(state);
    addHappiness(next, event.happiness);
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
    addHappiness(next, playHappinessGain * (1 - next.needs.happiness / clampMax));
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
