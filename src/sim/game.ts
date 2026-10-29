import { breedAttributes } from '../actor/breedAttributes';
import { maturityOf, naturalGrowth, zeroStats } from './attributes';
import { ensureProgress } from './progress';
import { trickListing } from './tricks';
import { emptyTrack, refreshUnlocks, speciesOf, trackDef, tracksFor } from './tracks';
import { refreshTraining, resolveReward } from './training';
import { traits } from './config';
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
    recentScenes: ['livingroom'],
  };
}

const unlockedAtAdoption = new Set(['sit', 'speak']);

export function blankTraining(species: 'dog' | 'cat'): Record<string, TrainingTrack> {
  const training: Record<string, TrainingTrack> = {};
  for (const def of tracksFor(species)) {
    training[def.id] = emptyTrack(def, unlockedAtAdoption.has(def.id));
  }
  return training;
}

function migrateTrained(state: PetState): PetState {
  if (state.attributes.trained) {
    return state;
  }
  const maturity = maturityOf(state.ageDays);
  const trained = zeroStats();
  for (const trait of traits) {
    const natural = naturalGrowth(state.attributes.potential[trait], maturity);
    trained[trait] = Math.max(0, state.attributes.current[trait] - natural);
  }
  return { ...state, attributes: { ...state.attributes, trained } };
}

function normalizeTrack(raw: Partial<TrainingTrack>, defId: string): TrainingTrack {
  const legacy = typeof raw.focusUsed !== 'number';
  return {
    id: defId,
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    unlocked: raw.unlocked === true,
    mastered: raw.mastered === true,
    focusUsed: legacy ? 0 : raw.focusUsed ?? 0,
    restUntil: legacy || typeof raw.restUntil !== 'number' ? null : raw.restUntil,
    hadNoTreat: legacy ? false : raw.hadNoTreat === true,
    pendingPenalty: false,
    lastPracticedAt: typeof raw.lastPracticedAt === 'number' ? raw.lastPracticedAt : null,
    source: raw.source === 'purchase' || raw.source === 'starter' ? raw.source : starterIds.has(defId) ? 'starter' : 'purchase',
  };
}

const starterIds = new Set(['sit', 'speak', 'paw']);

// Foreground and return both come through here. Expired trick rewards resolve.
// Away needs are applied before this runs, so a long absence does not raise happiness.
export function advanceCare(
  state: PetState,
  now: number,
  _wallMs: number,
  _awakeMs: number,
  mode: 'live' | 'away',
): PetState {
  let next = refreshTraining(state, now);
  if (next.care.pendingReward && mode === 'away') {
    next = resolveReward(next, now, 'none');
  }
  return refreshUnlocks(next).state;
}

// Old saves predate later tricks. Drop house training if a previous build stored it.
export function ensureGame(state: PetState): PetState {
  const species = speciesOf(state.breedId);
  const base = migrateTrained(state);
  const care = base.care?.hygiene != null ? base.care : blankCare(base.lastUpdatedAt, bathToleranceFor(base.attributes.potential.boldness, base.breedId, species));
  const training = base.training && Object.keys(base.training).length > 0 ? { ...base.training } : blankTraining(species);
  delete training.house_training;
  for (const id of Object.keys(training)) {
    if (!trackDef(id) && !trickListing(id)) {
      delete training[id];
      continue;
    }
    const raw = training[id];
    if (raw) {
      training[id] = normalizeTrack(raw, id);
    }
  }
  for (const def of tracksFor(species)) {
    if (!training[def.id]) {
      training[def.id] = emptyTrack(def, unlockedAtAdoption.has(def.id));
    }
  }
  const milestones = (Array.isArray(base.milestones) ? base.milestones : []).filter(
    (id) => id !== 'house_trained' && id !== 'house_training',
  );
  const next: PetState = {
    ...base,
    care: {
      ...blankCare(base.lastUpdatedAt, care.bathTolerance ?? 0),
      hygiene: care.hygiene ?? 80,
      lastBathAt: care.lastBathAt ?? null,
      lastBrushAt: care.lastBrushAt ?? null,
      bathTolerance: care.bathTolerance ?? 0,
      bathToleranceStart: care.bathToleranceStart ?? care.bathTolerance ?? 0,
      pendingReward: care.pendingReward ?? null,
      recentScenes: care.recentScenes ?? [base.sceneId],
    },
    training,
    milestones,
    seenCoachMarks: state.seenCoachMarks ?? [],
    parkFinds: state.parkFinds ?? {
      firstFindVisitDone: false,
      items: [],
      pendingRevealModal: null,
    },
  };
  return refreshUnlocks(ensureProgress(next)).state;
}
