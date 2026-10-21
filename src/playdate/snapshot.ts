import { breedById } from '../actor/breeds';
import type { ActorSource } from '../actor/types';
import { styleBasis } from '../sim/attributes';
import { currentStyle } from '../sim/offers';
import type { Equipped, PetState } from '../sim/types';
import type { PetSnapshot } from './types';

export function snapshotPet(pet: PetState, outfit: Equipped, createdAt: string, snapshotId: string): PetSnapshot {
  const species = breedById(pet.breedId)?.species ?? 'dog';
  return {
    snapshotId,
    petId: pet.id,
    source: 'self',
    name: pet.name,
    species,
    breedId: pet.breedId,
    look: { ...pet.look },
    equipped: { ...outfit },
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

export function actorSourceOf(snapshot: PetSnapshot): ActorSource {
  return {
    id: snapshot.snapshotId,
    breedId: snapshot.breedId,
    ageDays: snapshot.ageDays,
    weight: snapshot.weight,
    vitality: snapshot.vitality,
    equipped: { ...snapshot.equipped },
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
