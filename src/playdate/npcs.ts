import { catBreeds, coatStylesFor, dogBreeds } from '../actor/breeds';
import type { Breed, ParkOffer } from '../actor/types';
import { outfitSlots, wardrobe } from '../actor/wardrobe';
import { starterOutfits } from '../economy/catalog';
import { loadShopCatalog } from '../economy/shopState';
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

function shopCatalog() {
  try {
    return loadShopCatalog();
  } catch {
    return null;
  }
}

const starterWear = new Set(
  starterOutfits().flatMap((item) => (item.slot && item.wearId ? [`${item.slot}:${item.wearId}`] : [])),
);

export function npcMayWear(
  slot: OutfitSlot,
  wearId: string,
  catalog: { items: { id: string; tier: string }[] } | null,
): boolean {
  const shopId = `${slot}:${wearId}`;
  if (!catalog) {
    return starterWear.has(shopId);
  }
  const row = catalog.items.find((entry) => entry.id === shopId);
  if (!row) {
    return true;
  }
  return row.tier !== 'exclusive' && row.tier !== 'limited';
}

function wear(rng: () => number): Equipped {
  const catalog = shopCatalog();
  const count = 1 + pickIndex(rng, 3);
  const slots = shuffle(outfitSlots, rng).slice(0, count);
  const equipped: Equipped = {};
  for (const slot of slots) {
    const choices = wardrobe[slot].items.filter((item) => item.id !== 'none' && npcMayWear(slot, item.id, catalog));
    const item = choices.length > 0 ? choices[pickIndex(rng, choices.length)] : undefined;
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

export function parkOfferFromSnapshot(snapshot: PetSnapshot): ParkOffer {
  return {
    id: snapshot.snapshotId,
    breedId: snapshot.breedId,
    species: snapshot.species,
    ageDays: snapshot.ageDays,
    weight: snapshot.weight,
    vitality: snapshot.vitality,
    seed: snapshot.seed,
    boldness: snapshot.attributes.boldness,
    affection: snapshot.attributes.affection,
    look: snapshot.look,
    equipped: snapshot.equipped,
    ...(snapshot.wearDefs ? { wearDefs: snapshot.wearDefs } : {}),
  };
}

export function parkStranger(ownerId: string, nonce: number): PetSnapshot {
  const rng = rngFrom(ownerId, 'park-stranger', nonce);
  const species: Species = rng() < 0.5 ? 'dog' : 'cat';
  const breeds = species === 'dog' ? dogBreeds() : catBreeds();
  const breed = breeds[pickIndex(rng, breeds.length)];
  const name = names[pickIndex(rng, names.length)];
  return oneNpc(ownerId, 800 + (Math.abs(Math.floor(nonce)) % 200), species, breed, name);
}

export function parkStrangerOffer(ownerId: string, nonce: number): ParkOffer {
  return parkOfferFromSnapshot(parkStranger(ownerId, nonce));
}
