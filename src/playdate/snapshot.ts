import { breedById } from '../actor/breeds';
import { outfitSlots, wardrobe, wearItem } from '../actor/wardrobe';
import type { ActorSource } from '../actor/types';
import { styleBasis } from '../sim/attributes';
import { currentStyle } from '../sim/offers';
import type { Archetype, Equipped, Look, PetState, Stats } from '../sim/types';
import type { PetSnapshot } from './types';

function remoteWearDefs(outfit: Equipped): PetSnapshot['wearDefs'] {
  const defs: NonNullable<PetSnapshot['wearDefs']> = {};
  let any = false;
  for (const slot of outfitSlots) {
    const id = outfit[slot];
    if (!id || wardrobe[slot].items.some((item) => item.id === id)) {
      continue;
    }
    const wear = wearItem(slot, id);
    if (!wear) {
      continue;
    }
    defs[slot] = wear;
    any = true;
  }
  return any ? defs : undefined;
}

export function snapshotPet(pet: PetState, outfit: Equipped, createdAt: string, snapshotId: string): PetSnapshot {
  const species = breedById(pet.breedId)?.species ?? 'dog';
  const wearDefs = remoteWearDefs(outfit);
  return {
    snapshotId,
    petId: pet.id,
    source: 'self',
    name: pet.name,
    species,
    breedId: pet.breedId,
    look: { ...pet.look },
    equipped: { ...outfit },
    ...(wearDefs ? { wearDefs } : {}),
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    seed: pet.attributes.seed,
    originArchetype: pet.attributes.archetype,
    currentStyle: currentStyle(pet.attributes.archetype, styleBasis(pet), pet.attributes.potential),
    attributes: { ...pet.attributes.current },
    potential: { ...pet.attributes.potential },
    favoriteActivities: [],
    partyTricks: [],
    createdAt,
  };
}

export function snapshotFromFriend(
  userId: string,
  card: {
    petId?: string;
    name: string;
    breedId: string;
    look: Look;
    equipped: Equipped;
    ageDays: number;
    weight: number;
    vitality: number;
    seed: number;
    originArchetype: Archetype;
    attributes: Stats;
    potential: Stats;
  },
): PetSnapshot | null {
  if (!breedById(card.breedId) || !card.look?.coat || !card.name) {
    return null;
  }
  const wearDefs = remoteWearDefs(card.equipped);
  const species = breedById(card.breedId)?.species === 'cat' ? 'cat' : 'dog';
  return {
    snapshotId: `friend:${userId}`,
    petId: card.petId,
    source: 'friend',
    name: card.name,
    species,
    breedId: card.breedId,
    look: card.look,
    equipped: card.equipped,
    ...(wearDefs ? { wearDefs } : {}),
    ageDays: card.ageDays,
    weight: card.weight,
    vitality: card.vitality,
    seed: card.seed || 1,
    originArchetype: card.originArchetype,
    currentStyle: currentStyle(card.originArchetype, card.attributes, card.potential),
    attributes: card.attributes,
    potential: card.potential,
    favoriteActivities: [],
    partyTricks: [],
    createdAt: '',
  };
}

export function actorSourceOf(snapshot: PetSnapshot): ActorSource {
  return {
    id: snapshot.snapshotId,
    breedId: snapshot.breedId,
    ageDays: snapshot.ageDays,
    weight: snapshot.weight,
    vitality: snapshot.vitality,
    equipped: { ...snapshot.equipped },
    ...(snapshot.wearDefs ? { wearDefs: snapshot.wearDefs } : {}),
    look: { ...snapshot.look },
    asleep: false,
    seed: snapshot.seed,
    energy: 0.8,
    mood: 0.8,
    cuddleAffinity: Math.min(1, Math.max(0, snapshot.attributes.affection / 100)),
    stats: {
      stamina: Math.min(1, Math.max(0, snapshot.attributes.stamina / 100)),
      agility: Math.min(1, Math.max(0, snapshot.attributes.agility / 100)),
      boldness: Math.min(1, Math.max(0, snapshot.attributes.boldness / 100)),
      obedience: Math.min(1, Math.max(0, snapshot.attributes.obedience / 100)),
    },
  };
}
