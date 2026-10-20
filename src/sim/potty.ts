import { breedAttributes } from '../actor/breedAttributes';
import { careConfig } from './careConfig';
import { drainMesses, spawnMess } from './messes';
import { nextRng } from './rng';
import { markHousePenalty, resolveReward, trainedEnough } from './training';
import { emptyTrack, refreshUnlocks, speciesOf, tracksFor } from './tracks';
import { stageOf } from './attributes';
import type { PetCareState, PetState, TrainingTrack } from './types';

const hourMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;

function roll(state: PetState): { state: PetState; value: number } {
  const next = nextRng(state.rngState);
  return { state: { ...state, rngState: next.state }, value: next.value };
}

function jitter(value: number, span: number, unit: number): number {
  return value * (1 - span + unit * span * 2);
}

export function urgeDelayMs(state: PetState, unit: number): number {
  const progress = state.training.house_training?.progress ?? 0;
  const base = careConfig.urgeMinutes[stageOf(state.ageDays)] * minuteMs;
  const stretched = base * (1 + careConfig.urgeStretch * (progress / 100));
  return jitter(stretched, careConfig.urgeJitter, unit);
}

function scheduleUrge(state: PetState, now: number): PetState {
  const rolled = roll(state);
  const at = now + urgeDelayMs(rolled.state, rolled.value);
  return {
    ...rolled.state,
    care: {
      ...rolled.state.care,
      potty: { ...rolled.state.care.potty, nextUrgeAt: at, signal: null, pausedAt: null },
    },
  };
}

function reurge(state: PetState, now: number): PetState {
  const rolled = roll(state);
  const wait = careConfig.reurgeMinMs + rolled.value * (careConfig.reurgeMaxMs - careConfig.reurgeMinMs);
  return {
    ...rolled.state,
    care: {
      ...rolled.state.care,
      potty: { ...rolled.state.care.potty, nextUrgeAt: now + wait, signal: null, outing: null, pausedAt: null },
    },
  };
}

function missWindow(state: PetState, now: number): PetState {
  const sceneId = state.sceneId;
  const outdoor = careConfig.outdoorScenes.includes(sceneId);
  let next = spawnMess(state, sceneId, now);
  if (!outdoor) {
    next = markHousePenalty(next);
  }
  return scheduleUrge(next, now);
}

function accidents(state: PetState, awakeMs: number, now: number): PetState {
  if (trainedEnough(state) || awakeMs <= 0) {
    return state;
  }
  let next = state;
  let left = awakeMs;
  while (left > 0 && next.care.messes.length < careConfig.maxMesses) {
    const chunk = Math.min(left, hourMs);
    const rolled = roll(next);
    next = rolled.state;
    if (rolled.value < careConfig.randomAccidentPerHour * (chunk / hourMs)) {
      next = spawnMess(next, next.sceneId, now);
    }
    left -= chunk;
  }
  return next;
}

function pauseForSleep(state: PetState, asleepMs: number): PetState {
  if (asleepMs <= 0) {
    return state;
  }
  const potty = state.care.potty;
  return {
    ...state,
    care: {
      ...state.care,
      potty: {
        ...potty,
        nextUrgeAt: potty.nextUrgeAt == null ? null : potty.nextUrgeAt + asleepMs,
        pausedAt: state.asleep ? state.lastUpdatedAt : potty.pausedAt,
      },
    },
  };
}

// Foreground and return both come through here. Signals only start while `mode` is live.
export function advanceCare(
  state: PetState,
  now: number,
  wallMs: number,
  awakeMs: number,
  mode: 'live' | 'away',
): PetState {
  let next = pauseForSleep(state, Math.max(0, wallMs - awakeMs));
  next = drainMesses(next, awakeMs);

  if (next.care.pendingReward && (mode === 'away' || now - next.care.pendingReward.openedAt >= careConfig.rewardLateMs)) {
    next = resolveReward(next, now, null);
  }

  const potty = next.care.potty;
  if (potty.outing && mode === 'away') {
    next = reurge({ ...next, sceneId: potty.outing.returnSceneId }, now);
  } else if (potty.outing && mode === 'live' && now >= potty.outing.goesAt) {
    next = scheduleUrge(
      {
        ...next,
        care: {
          ...next.care,
          returnSceneId: potty.outing.returnSceneId,
          potty: { ...next.care.potty, outing: null },
        },
      },
      now,
    );
    next = {
      ...next,
      care: { ...next.care, pendingReward: { trackId: 'house_training', openedAt: now } },
    };
  }

  if (!trainedEnough(next)) {
    const signal = next.care.potty.signal;
    if (signal && mode === 'away') {
      next = wallMs > careConfig.resumeGraceMs ? reurge(next, now) : next;
    } else if (signal && mode === 'live') {
      const remaining = signal.remainingMs - awakeMs;
      if (remaining <= 0) {
        next = missWindow(next, now);
      } else {
        next = {
          ...next,
          care: {
            ...next.care,
            potty: { ...next.care.potty, signal: { ...signal, remainingMs: remaining }, pausedAt: null },
          },
        };
      }
    } else if (
      !next.care.pendingReward &&
      !next.care.potty.signal &&
      !next.asleep &&
      next.care.potty.nextUrgeAt != null &&
      now >= next.care.potty.nextUrgeAt
    ) {
      if (mode === 'live') {
        next = {
          ...next,
          care: {
            ...next.care,
            potty: {
              ...next.care.potty,
              signal: { startedAt: now, remainingMs: careConfig.signalWindowMs },
              pausedAt: null,
            },
          },
        };
      } else {
        next = reurge(next, now);
      }
    }
    next = accidents(next, awakeMs, now);
  }

  if (mode === 'away' && wallMs >= careConfig.welcomeBackMs) {
    next = {
      ...next,
      needs: {
        ...next.needs,
        happiness: Math.max(next.needs.happiness, careConfig.awayHappinessFloor),
      },
    };
  }

  return refreshUnlocks(next).state;
}

export function rememberScene(state: PetState, sceneId: string): PetState {
  const recent = [sceneId, ...state.care.recentScenes.filter((id) => id !== sceneId)].slice(0, 6);
  return { ...state, care: { ...state.care, recentScenes: recent } };
}

export function bathToleranceFor(boldnessPotential: number, breedId: string, species: 'dog' | 'cat'): number {
  let min = Infinity;
  let max = -Infinity;
  for (const data of Object.values(breedAttributes)) {
    min = Math.min(min, data.ranges.boldness[0]);
    max = Math.max(max, data.ranges.boldness[1]);
  }
  const span = max - min || 1;
  const t = Math.max(0, Math.min(1, (boldnessPotential - min) / span));
  const affinity = breedId === 'retriever' ? 30 : 0;
  const speciesMod = species === 'cat' ? -40 : 0;
  const value = Math.round(-60 + t * 120) + affinity + speciesMod;
  return Math.max(-100, Math.min(100, value));
}

export function blankCare(now: number, tolerance: number): PetCareState {
  return {
    hygiene: 80,
    lastBathAt: null,
    lastBrushAt: null,
    messes: [],
    litterBoxFill: 0,
    potty: { nextUrgeAt: now + 90 * minuteMs, signal: null, pausedAt: null, outing: null },
    walk: { dueAt: null },
    bathTolerance: tolerance,
    bathToleranceStart: tolerance,
    pendingReward: null,
    returnSceneId: null,
    unclaimed: { basic: 0, special: 0 },
    recentScenes: ['livingroom'],
  };
}

const unlockedAtAdoption = new Set(['house_training', 'sit', 'speak']);

export function blankTraining(species: 'dog' | 'cat', petDay: number, houseMastered: boolean): Record<string, TrainingTrack> {
  const training: Record<string, TrainingTrack> = {};
  for (const def of tracksFor(species)) {
    const track = emptyTrack(def, petDay, unlockedAtAdoption.has(def.id));
    if (def.id === 'house_training' && houseMastered) {
      track.progress = 100;
      track.mastered = true;
      track.unlocked = true;
    }
    training[def.id] = track;
  }
  return training;
}

export function beginPotty(state: PetState, now: number): PetState {
  if (trainedEnough(state) || !state.care.potty.signal) {
    return state;
  }
  const rolled = roll(state.care.pendingReward ? resolveReward(state, now, null) : state);
  const species = speciesOf(rolled.state.breedId);
  const delay = species === 'dog'
    ? careConfig.walkPottyMinMs + rolled.value * (careConfig.walkPottyMaxMs - careConfig.walkPottyMinMs)
    : careConfig.catPottyDelayMs;
  const returnSceneId = rolled.state.sceneId === 'sidewalk' ? 'livingroom' : rolled.state.sceneId;
  const sceneId = species === 'dog' ? 'sidewalk' : rolled.state.sceneId;
  return rememberScene(
    {
      ...rolled.state,
      sceneId,
      care: {
        ...rolled.state.care,
        returnSceneId,
        potty: {
          ...rolled.state.care.potty,
          signal: null,
          outing: { returnSceneId, goesAt: now + delay },
        },
      },
    },
    sceneId,
  );
}

export function headHome(state: PetState, now: number): PetState {
  const resolved = state.care.pendingReward ? resolveReward(state, now, null) : state;
  const sceneId = resolved.care.returnSceneId ?? resolved.sceneId;
  return rememberScene(
    {
      ...resolved,
      sceneId,
      care: { ...resolved.care, returnSceneId: null },
    },
    sceneId,
  );
}

export function armPotty(state: PetState, now: number): PetState {
  if (trainedEnough(state)) {
    return {
      ...state,
      care: { ...state.care, potty: { ...state.care.potty, nextUrgeAt: null, signal: null, outing: null } },
    };
  }
  return scheduleUrge(state, now);
}

export function speciesOfPet(state: PetState): 'dog' | 'cat' {
  return speciesOf(state.breedId);
}

// Old saves predate care. Adults skip house training so they are not sent back to puppy chores.
export function ensureGame(state: PetState): PetState {
  const species = speciesOf(state.breedId);
  const day = Math.floor(Math.max(0, state.ageDays));
  const mastered = state.ageDays >= careConfig.legacyHouseTrainedDays;
  const care = state.care?.potty ? state.care : blankCare(state.lastUpdatedAt, bathToleranceFor(state.attributes.potential.boldness, state.breedId, species));
  const training = state.training?.house_training ? state.training : blankTraining(species, day, mastered);
  const milestones = Array.isArray(state.milestones) ? state.milestones : mastered ? ['house_trained'] : [];
  let next: PetState = {
    ...state,
    care: {
      ...blankCare(state.lastUpdatedAt, care.bathTolerance),
      ...care,
      potty: { ...blankCare(state.lastUpdatedAt, 0).potty, ...care.potty },
      walk: { dueAt: care.walk?.dueAt ?? null },
      unclaimed: care.unclaimed ?? { basic: 0, special: 0 },
      messes: care.messes ?? [],
      recentScenes: care.recentScenes ?? [state.sceneId],
    },
    training,
    milestones,
    seenCoachMarks: state.seenCoachMarks ?? [],
  };
  if (next.training.house_training?.mastered) {
    next = {
      ...next,
      milestones: next.milestones.includes('house_trained') ? next.milestones : [...next.milestones, 'house_trained'],
      care: { ...next.care, potty: { ...next.care.potty, nextUrgeAt: null, signal: null, outing: null } },
    };
  }
  return refreshUnlocks(next).state;
}
