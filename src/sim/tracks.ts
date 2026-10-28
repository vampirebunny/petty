import { breedById } from '../actor/breeds';
import type { TrickTier } from './careConfig';
import { attributeScore } from './attributes';
import { trickListing } from './tricks';
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
  // When true, mastering any listed prerequisite unlocks the track.
  anyPrerequisite?: boolean;
  unlock: Partial<Record<SpeciesId, UnlockRule>>;
  tier?: TrickTier;
  linked: Trait[];
  button: 'main' | 'panel';
};

// This slice ships the tracks whose poses already exist. Later tricks stay out until they have animation.
export const trackDefs: TrackDef[] = [
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
    linked: ['boldness'],
    button: 'main',
  },
  {
    id: 'paw',
    name: 'Paw',
    species: ['dog', 'cat'],
    hideWhenMastered: false,
    prerequisites: { dog: ['sit', 'speak'], cat: ['sit', 'speak'] },
    anyPrerequisite: true,
    unlock: {},
    tier: 2,
    linked: ['affection'],
    button: 'main',
  },
];

const byId = new Map(trackDefs.map((def) => [def.id, def]));

export function trackDef(id: string): TrackDef | null {
  const known = byId.get(id);
  if (known) {
    return known;
  }
  const listing = trickListing(id);
  if (!listing) {
    return null;
  }
  return {
    id: listing.id,
    name: listing.name,
    species: [listing.species],
    hideWhenMastered: true,
    prerequisites: {},
    unlock: {},
    tier: 1,
    linked: listing.attributesRaised,
    button: 'panel',
  };
}

export function trackName(id: string, species: SpeciesId): string {
  if (id === 'paw' && species === 'cat') {
    return 'High five';
  }
  return trackDef(id)?.name ?? id;
}

export function speciesOf(breedId: string): SpeciesId {
  return breedById(breedId)?.species === 'cat' ? 'cat' : 'dog';
}

export function tracksFor(species: SpeciesId): TrackDef[] {
  return trackDefs.filter((def) => def.species.includes(species));
}

export function masteredTrickIds(pet: PetState): string[] {
  return pet.milestones.filter((id) => trackDef(id) != null);
}

export function emptyTrack(def: TrackDef, unlocked: boolean, source: TrainingTrack['source'] = 'starter'): TrainingTrack {
  return {
    id: def.id,
    progress: 0,
    unlocked,
    mastered: false,
    focusUsed: 0,
    restUntil: null,
    hadNoTreat: false,
    pendingPenalty: false,
    lastPracticedAt: null,
    source,
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
  if (ids.length === 0) {
    return true;
  }
  const learned = (id: string) => state.training[id]?.mastered === true;
  return def.anyPrerequisite ? ids.some(learned) : ids.every(learned);
}

export function isUnlocked(state: PetState, def: TrackDef): boolean {
  const species = speciesOf(state.breedId);
  if (!def.species.includes(species)) {
    return false;
  }
  return prereqsMet(state, def, species) && ruleMet(state, def.unlock[species]);
}

// Newly unlocked tracks this pass.
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
    unlocked.push(def.id);
  }
  return { state: { ...state, training }, unlocked };
}

export function lockHint(state: PetState, def: TrackDef): string | null {
  const species = speciesOf(state.breedId);
  const track = state.training[def.id];
  if (!track || track.unlocked) {
    return null;
  }
  const needed = def.prerequisites[species] ?? [];
  const missing = needed.filter((id) => !state.training[id]?.mastered);
  if (def.anyPrerequisite ? missing.length === needed.length && needed.length > 0 : missing.length > 0) {
    const names = (def.anyPrerequisite ? needed : missing.slice(0, 1)).map((id) => trackDef(id)?.name ?? id);
    return `Keep practicing ${names.join(' or ')} to unlock.`;
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
