import { breedById } from '../actor/breeds';
import { careConfig, type TrickTier } from './careConfig';
import { attributeScore, stageOf } from './attributes';
import type { PetState, TrainingTrack, Trait } from './types';

export type SpeciesId = 'dog' | 'cat';

export type UnlockRule = {
  minAgeDays?: number;
  minAttributes?: Partial<Record<Trait, number>>;
};

export type TrackDef = {
  id: string;
  name: string;
  species: SpeciesId[];
  hideWhenMastered: boolean;
  prerequisites: Partial<Record<SpeciesId, string[]>>;
  unlock: Partial<Record<SpeciesId, UnlockRule>>;
  tier?: TrickTier;
  linked: Trait[];
  button: 'main' | 'panel';
};

// This slice ships the tracks whose poses already exist. Later tricks stay out until they have animation.
export const trackDefs: TrackDef[] = [
  {
    id: 'house_training',
    name: 'House Training',
    species: ['dog', 'cat'],
    hideWhenMastered: true,
    prerequisites: {},
    unlock: {},
    linked: ['obedience'],
    button: 'panel',
  },
  {
    id: 'sit',
    name: 'Sit',
    species: ['dog', 'cat'],
    hideWhenMastered: false,
    prerequisites: {},
    unlock: {},
    tier: 1,
    linked: ['obedience'],
    button: 'main',
  },
  {
    id: 'speak',
    name: 'Speak',
    species: ['dog', 'cat'],
    hideWhenMastered: false,
    prerequisites: {},
    unlock: {},
    tier: 1,
    linked: ['obedience'],
    button: 'main',
  },
  {
    id: 'paw',
    name: 'Paw',
    species: ['dog'],
    hideWhenMastered: false,
    prerequisites: { dog: ['sit'] },
    unlock: { dog: { minAgeDays: 1 } },
    tier: 2,
    linked: ['obedience'],
    button: 'main',
  },
];

const byId = new Map(trackDefs.map((def) => [def.id, def]));

export function trackDef(id: string): TrackDef | null {
  return byId.get(id) ?? null;
}

export function speciesOf(breedId: string): SpeciesId {
  return breedById(breedId)?.species === 'cat' ? 'cat' : 'dog';
}

export function tracksFor(species: SpeciesId): TrackDef[] {
  return trackDefs.filter((def) => def.species.includes(species));
}

export function emptyTrack(def: TrackDef, petDay: number, unlocked: boolean): TrainingTrack {
  return {
    id: def.id,
    progress: 0,
    unlocked,
    mastered: false,
    repsToday: 0,
    repsPetDay: petDay,
    pendingPenalty: false,
    lastPracticedAt: null,
  };
}

function ruleMet(state: PetState, rule: UnlockRule | undefined): boolean {
  if (!rule) {
    return true;
  }
  if (rule.minAgeDays != null && state.ageDays < rule.minAgeDays) {
    return false;
  }
  if (rule.minAttributes) {
    for (const [trait, min] of Object.entries(rule.minAttributes) as [Trait, number][]) {
      if (attributeScore(state, trait) < min) {
        return false;
      }
    }
  }
  return true;
}

function prereqsMet(state: PetState, def: TrackDef, species: SpeciesId): boolean {
  const ids = def.prerequisites[species] ?? [];
  return ids.every((id) => state.training[id]?.mastered === true);
}

export function isUnlocked(state: PetState, def: TrackDef): boolean {
  const species = speciesOf(state.breedId);
  if (!def.species.includes(species)) {
    return false;
  }
  return prereqsMet(state, def, species) && ruleMet(state, def.unlock[species]);
}

// Newly unlocked tracks this pass. House training starts unlocked, so it is not announced.
export function refreshUnlocks(state: PetState): { state: PetState; unlocked: string[] } {
  const training = { ...state.training };
  const unlocked: string[] = [];
  for (const def of tracksFor(speciesOf(state.breedId))) {
    const track = training[def.id];
    if (!track || track.unlocked) {
      continue;
    }
    if (!isUnlocked(state, def)) {
      continue;
    }
    training[def.id] = { ...track, unlocked: true };
    if (def.id !== 'house_training') {
      unlocked.push(def.id);
    }
  }
  return { state: { ...state, training }, unlocked };
}

export function lockHint(state: PetState, def: TrackDef): string | null {
  const species = speciesOf(state.breedId);
  const track = state.training[def.id];
  if (!track || track.unlocked) {
    return null;
  }
  const missing = (def.prerequisites[species] ?? []).find((id) => !state.training[id]?.mastered);
  if (missing) {
    const name = trackDef(missing)?.name ?? missing;
    return `Keep practicing ${name} to unlock.`;
  }
  const rule = def.unlock[species];
  if (rule?.minAgeDays != null && state.ageDays < rule.minAgeDays) {
    return `${state.name} needs to grow up a little before learning this.`;
  }
  if (rule?.minAttributes) {
    for (const [trait, min] of Object.entries(rule.minAttributes) as [Trait, number][]) {
      if (attributeScore(state, trait) < min) {
        return trait === 'obedience'
          ? `${state.name} needs to get a bit more focused first.`
          : `${state.name} needs to get a bit smarter first.`;
      }
    }
  }
  return null;
}

export function houseTrained(state: PetState): boolean {
  return state.training.house_training?.mastered === true;
}

export function ageFactorOf(state: PetState): number {
  return careConfig.ageFactor[stageOf(state.ageDays)];
}
