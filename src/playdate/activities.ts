import { stageOf } from '../sim/attributes';
import type { Stage } from '../sim/types';
import { playdateConfig } from './config';
import { pickIndex, rngFrom } from './rng';
import type { ActivityDefinition, ActivityId, BeatTemplateId, PetSnapshot, Species, SpeciesPair } from './types';

const stageOrder: Stage[] = ['puppy', 'olderPuppy', 'adolescent', 'adult', 'senior'];

function templates(
  dogs: BeatTemplateId | null,
  cats: BeatTemplateId | null,
  cross: BeatTemplateId | null,
): Record<SpeciesPair, BeatTemplateId | null> {
  return { 'dog-dog': dogs, 'cat-cat': cats, 'dog-cat': cross };
}

function pairs(map: Record<SpeciesPair, BeatTemplateId | null>): SpeciesPair[] {
  return (Object.keys(map) as SpeciesPair[]).filter((pair) => map[pair] != null);
}

function define(
  id: ActivityId,
  name: string,
  map: Record<SpeciesPair, BeatTemplateId | null>,
  attributesTrained: ActivityDefinition['attributesTrained'],
  scenes: ActivityDefinition['scenes'] = 'any',
  maxAgeStage?: ActivityDefinition['maxAgeStage'],
): ActivityDefinition {
  return {
    id,
    name,
    speciesPairs: pairs(map),
    scenes,
    maxAgeStage,
    attributesTrained,
    templates: map,
  };
}

export const activities: ActivityDefinition[] = [
  define('fetch', 'Fetch', templates('fetch-dogs', null, 'fetch-cross'), { agility: 3, stamina: 2 }),
  define('tug', 'Tug-of-war', templates('tug-dogs', null, null), { stamina: 3, boldness: 2 }),
  define('race', 'Race', templates('race-dogs', 'race-cats', 'race-cross'), { agility: 4, stamina: 2 }, 'any', 'adult'),
  define('chase', 'Chase', templates('chase-dogs', 'chase-cats', 'chase-cross'), { stamina: 3, agility: 2 }),
  define('hide', 'Hide-and-seek', templates('hide-any', 'hide-any', 'hide-any'), { intelligence: 3, agility: 1 }),
  define('sniff', 'Sniff and explore', templates('sniff-any', 'sniff-any', 'sniff-any'), { affection: 2, intelligence: 1 }),
  define('splash', 'Splash', templates('splash-dogs', null, null), { stamina: 2, boldness: 2 }, ['park']),
  define('nap', 'Nap together', templates('nap-any', 'nap-any', 'nap-any'), { affection: 3 }),
  define('trick', 'Trick show-off', templates('trick-any', 'trick-any', 'trick-cross'), { intelligence: 3, obedience: 2 }),
];

export function activityById(id: string): ActivityDefinition | null {
  return activities.find((activity) => activity.id === id) ?? null;
}

export function speciesPair(a: Species, b: Species): SpeciesPair {
  if (a === 'dog' && b === 'dog') {
    return 'dog-dog';
  }
  if (a === 'cat' && b === 'cat') {
    return 'cat-cat';
  }
  return 'dog-cat';
}

export function speciesCanPlay(activity: ActivityDefinition, species: Species): boolean {
  return activity.speciesPairs.some((pair) => pair === 'dog-cat' || pair.startsWith(species));
}

function stageFits(ageDays: number, maxAgeStage: ActivityDefinition['maxAgeStage']): boolean {
  if (!maxAgeStage) {
    return true;
  }
  return stageOrder.indexOf(stageOf(ageDays)) <= stageOrder.indexOf(maxAgeStage);
}

export function legalActivities(
  petA: PetSnapshot,
  petB: PetSnapshot,
  sceneId: string,
  allowCrossSpecies = playdateConfig.allowCrossSpecies,
): ActivityDefinition[] {
  const pair = speciesPair(petA.species, petB.species);
  if (pair === 'dog-cat' && !allowCrossSpecies) {
    return [];
  }
  return activities.filter((activity) => {
    if (!activity.speciesPairs.includes(pair) || activity.templates[pair] == null) {
      return false;
    }
    if (activity.scenes !== 'any' && !activity.scenes.includes(sceneId)) {
      return false;
    }
    return stageFits(petA.ageDays, activity.maxAgeStage) && stageFits(petB.ageDays, activity.maxAgeStage);
  });
}

function weightOf(activity: ActivityDefinition, favorites: readonly string[]): number {
  return favorites.includes(activity.id) ? 4 : 1;
}

// Up to 3 legal activities, weighted toward the partner's favorites.
// Stable for one date, partner, and place.
export function offerActivities(
  petA: PetSnapshot,
  petB: PetSnapshot,
  sceneId: string,
  date: string,
  allowCrossSpecies = playdateConfig.allowCrossSpecies,
): ActivityDefinition[] {
  const legal = legalActivities(petA, petB, sceneId, allowCrossSpecies);
  if (legal.length <= 3) {
    return legal;
  }
  const rng = rngFrom(date, petB.snapshotId, sceneId, 'activities');
  const pool = legal.slice();
  const picked: ActivityDefinition[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const weights = pool.map((activity) => weightOf(activity, petB.favoriteActivities));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export function trainedLabel(activity: ActivityDefinition): string {
  const names: Record<string, string> = {
    stamina: 'stamina',
    agility: 'agility',
    intelligence: 'intelligence',
    boldness: 'boldness',
    affection: 'affection',
    obedience: 'obedience',
  };
  const parts = Object.keys(activity.attributesTrained).map((trait) => names[trait] ?? trait);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return `Trains ${parts[0]}`;
  }
  return `Trains ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function pickFavorites(species: Species, rng: () => number): ActivityId[] {
  const legal = activities.filter((activity) => speciesCanPlay(activity, species));
  const count = 1 + pickIndex(rng, 2);
  const picked: ActivityId[] = [];
  const pool = legal.slice();
  while (picked.length < count && pool.length > 0) {
    const index = pickIndex(rng, pool.length);
    picked.push(pool.splice(index, 1)[0].id);
  }
  return picked;
}
