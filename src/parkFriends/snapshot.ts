import { breedById } from '../actor/breeds';
import { outfitSlots, wearItem, type WearItem } from '../actor/wardrobe';
import type { FriendPet } from '../friends/types';
import type { ParkOffer } from '../actor/types';

export type ParkFriendSpawn = {
  userId: string;
  handle: string;
  enteredAt: number;
  settled: boolean;
  offer: ParkOffer;
};
import type { Equipped, OutfitSlot, PetState } from '../sim/types';

export function parkPetSnapshot(pet: PetState): FriendPet {
  const wearDefs: Partial<Record<OutfitSlot, WearItem>> = {};
  for (const slot of outfitSlots) {
    const item = wearItem(slot, pet.equipped[slot]);
    if (item) {
      wearDefs[slot] = item;
    }
  }
  return {
    petId: pet.id,
    name: pet.name,
    breedId: pet.breedId,
    look: pet.look,
    equipped: pet.equipped,
    wearDefs,
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    seed: pet.attributes.seed,
    originArchetype: pet.attributes.archetype,
    attributes: pet.attributes.current,
    potential: pet.attributes.potential,
  };
}

function drawableEquipped(pet: FriendPet): { equipped: Equipped; wearDefs: FriendPet['wearDefs'] } {
  const equipped: Equipped = { ...pet.equipped };
  const wearDefs = { ...(pet.wearDefs ?? {}) };
  for (const slot of outfitSlots) {
    const id = equipped[slot];
    if (!id) {
      continue;
    }
    if (wearDefs[slot] || wearItem(slot, id)) {
      continue;
    }
    delete equipped[slot];
  }
  return { equipped, wearDefs };
}

export function friendNeedsCatalog(pet: FriendPet): boolean {
  for (const slot of outfitSlots) {
    const id = pet.equipped[slot];
    if (!id) {
      continue;
    }
    if (!pet.wearDefs?.[slot] && !wearItem(slot, id)) {
      return true;
    }
  }
  return false;
}

export function offerFromFriend(userId: string, pet: FriendPet): ParkOffer | null {
  const breed = breedById(pet.breedId);
  if (!breed || !pet.look?.coat) {
    return null;
  }
  const worn = drawableEquipped(pet);
  return {
    id: pet.petId || userId,
    breedId: pet.breedId,
    species: breed.species === 'cat' ? 'cat' : 'dog',
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    seed: pet.seed,
    boldness: pet.attributes.boldness ?? 50,
    affection: pet.attributes.affection ?? 50,
    look: pet.look,
    equipped: worn.equipped,
    wearDefs: worn.wearDefs,
  };
}
