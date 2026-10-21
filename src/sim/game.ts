import { breedAttributes } from '../actor/breedAttributes';
import { careConfig } from './careConfig';
import { emptyTrack, refreshUnlocks, speciesOf, tracksFor } from './tracks';
import { resolveReward } from './training';
import type { PetCareState, PetState, TrainingTrack } from './types';

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
    bathTolerance: tolerance,
    bathToleranceStart: tolerance,
    pendingReward: null,
    unclaimed: { basic: 0, special: 0 },
    recentScenes: ['livingroom'],
  };
}

const unlockedAtAdoption = new Set(['sit', 'speak']);

export function blankTraining(species: 'dog' | 'cat', petDay: number): Record<string, TrainingTrack> {
  const training: Record<string, TrainingTrack> = {};
  for (const def of tracksFor(species)) {
    training[def.id] = emptyTrack(def, petDay, unlockedAtAdoption.has(def.id));
  }
  return training;
}

// Foreground and return both come through here. Expired trick rewards resolve.
// Away needs are applied before this runs, so a long absence does not raise happiness.
export function advanceCare(
  state: PetState,
  now: number,
  _wallMs: number,
  _awakeMs: number,
  mode: 'live' | 'away',
): PetState {
  let next = state;
  if (next.care.pendingReward && (mode === 'away' || now - next.care.pendingReward.openedAt >= careConfig.rewardLateMs)) {
    next = resolveReward(next, now, null);
  }
  return refreshUnlocks(next).state;
}

// Old saves predate later tricks. Drop house training if a previous build stored it.
export function ensureGame(state: PetState): PetState {
  const species = speciesOf(state.breedId);
  const day = Math.floor(Math.max(0, state.ageDays));
  const care = state.care?.unclaimed ? state.care : blankCare(state.lastUpdatedAt, bathToleranceFor(state.attributes.potential.boldness, state.breedId, species));
  const training = state.training && Object.keys(state.training).length > 0 ? { ...state.training } : blankTraining(species, day);
  delete training.house_training;
  for (const def of tracksFor(species)) {
    if (!training[def.id]) {
      training[def.id] = emptyTrack(def, day, unlockedAtAdoption.has(def.id));
    }
  }
  const milestones = (Array.isArray(state.milestones) ? state.milestones : []).filter(
    (id) => id !== 'house_trained' && id !== 'house_training',
  );
  const next: PetState = {
    ...state,
    care: {
      ...blankCare(state.lastUpdatedAt, care.bathTolerance ?? 0),
      hygiene: care.hygiene ?? 80,
      lastBathAt: care.lastBathAt ?? null,
      lastBrushAt: care.lastBrushAt ?? null,
      bathTolerance: care.bathTolerance ?? 0,
      bathToleranceStart: care.bathToleranceStart ?? care.bathTolerance ?? 0,
      pendingReward: care.pendingReward ?? null,
      unclaimed: care.unclaimed ?? { basic: 0, special: 0 },
      recentScenes: care.recentScenes ?? [state.sceneId],
    },
    training,
    milestones,
    seenCoachMarks: state.seenCoachMarks ?? [],
  };
  return refreshUnlocks(next).state;
}
