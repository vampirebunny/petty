import { catBreeds, coatStylesFor, dogBreeds } from '../actor/breeds';
import type { Breed } from '../actor/types';
import { outfitSlots, wardrobe } from '../actor/wardrobe';
import { attributesFor, currentStyle } from '../sim/offers';
import { archetypes } from '../sim/config';
import type { Equipped, OutfitSlot } from '../sim/types';
import { pickFavorites } from './activities';
import { playdateConfig } from './config';
import { pickIndex, rngFrom, shuffle } from './rng';
import type { PartyTrick, PetSnapshot, Species } from './types';

const names = [
  'Miso',
  'Pip',
  'Noodle',
  'Biscuit',
  'Clover',
  'Juniper',
  'Maple',
  'Pebble',
  'Sunny',
  'Wren',
  'Fig',
  'Olive',
  'Pepper',
  'Mocha',
  'Hazel',
  'Cosmo',
  'Lulu',
  'Benny',
  'Daisy',
  'Milo',
  'Luna',
  'Otto',
  'Coco',
  'Rudy',
];

const ages = [1, 3, 8, 14, 18, 24, 32, 4, 10, 16, 20, 38];

const partyTricks: PartyTrick[] = ['sit', 'paw', 'speak'];

function wear(rng: () => number): Equipped {
  const count = 1 + pickIndex(rng, 3);
  const slots = shuffle(outfitSlots, rng).slice(0, count);
  const equipped: Equipped = {};
  for (const slot of slots) {
    const choices = wardrobe[slot].items.filter((item) => item.id !== 'none');
    const item = choices[pickIndex(rng, choices.length)];
    if (item) {
      equipped[slot as OutfitSlot] = item.id;
    }
  }
  return equipped;
}

function tricks(rng: () => number): PartyTrick[] {
  const count = 1 + pickIndex(rng, 2);
  return shuffle(partyTricks, rng).slice(0, count);
}

function oneNpc(ownerId: string, index: number, species: Species, breed: Breed, name: string): PetSnapshot {
  const rng = rngFrom(ownerId, 'npc', index);
  const archetype = archetypes[pickIndex(rng, archetypes.length)];
  const seed = Math.floor(rng() * 0x7fffffff);
  const attributes = attributesFor(seed, species, breed.id, breed.attributeRanges, archetype);
  const coats = coatStylesFor(breed);
  const coat = coats[pickIndex(rng, coats.length)];
  return {
    snapshotId: `npc-${index}`,
    source: 'npc',
    name,
    species,
    breedId: breed.id,
    look: {
      coat: coat.coat,
      ...(coat.pattern ? { pattern: coat.pattern } : {}),
      ...(coat.accent ? { accent: coat.accent } : {}),
    },
    equipped: wear(rng),
    ageDays: ages[index % ages.length],
    weight: Math.round((rng() * 0.6 - 0.3) * 100) / 100,
    vitality: 0.75 + rng() * 0.25,
    seed,
    originArchetype: archetype,
    currentStyle: currentStyle(archetype, attributes.current, attributes.potential),
    attributes: { ...attributes.current },
    potential: { ...attributes.potential },
    favoriteActivities: pickFavorites(species, rng),
    partyTricks: tricks(rng),
    createdAt: 'cast',
  };
}

export function generateCast(ownerId: string): PetSnapshot[] {
  const rng = rngFrom(ownerId, 'cast');
  const count = playdateConfig.castMin + pickIndex(rng, playdateConfig.castMax - playdateConfig.castMin + 1);
  const dogs = dogBreeds();
  const cats = catBreeds();
  const namePool = shuffle(names, rng);
  const cast: PetSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    const species: Species = index % 2 === 0 ? 'dog' : 'cat';
    const breeds = species === 'dog' ? dogs : cats;
    const breed = breeds[pickIndex(rng, breeds.length)];
    cast.push(oneNpc(ownerId, index, species, breed, namePool[index % namePool.length]));
  }
  return cast;
}

function withSpecies(picked: PetSnapshot[], cast: readonly PetSnapshot[], species: Species): PetSnapshot[] {
  if (picked.some((pet) => pet.species === species)) {
    return picked;
  }
  const standin = cast.find(
    (pet) => pet.species === species && !picked.some((chosen) => chosen.snapshotId === pet.snapshotId),
  );
  if (!standin) {
    return picked;
  }
  const next = picked.slice();
  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i].species !== species) {
      next[i] = standin;
      break;
    }
  }
  return next;
}

export function dailyCast(cast: readonly PetSnapshot[], ownerId: string, date: string): PetSnapshot[] {
  const rng = rngFrom(ownerId, date, 'daily');
  const picked = shuffle(cast, rng).slice(0, playdateConfig.dailyCount);
  return withSpecies(withSpecies(picked, cast, 'dog'), cast, 'cat');
}
