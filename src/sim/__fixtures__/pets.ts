import { breedById, defaultLook } from '../../actor/breeds';
import { createPet } from '../createPet';
import { attributesFor } from '../offers';
import type { Archetype, PetState } from '../types';

// A pet built the way adoption builds one: offers from the breed's ranges, then the picked archetype.
export function testPet(
  seed: number,
  breedId: string,
  now: number,
  name: string,
  id: string,
  archetype: Archetype = 'athlete',
): PetState {
  const breed = breedById(breedId);
  if (!breed) {
    throw new Error(`Unknown breed ${breedId}`);
  }
  return createPet({
    id,
    ownerId: 'test-owner',
    name,
    breedId,
    look: defaultLook(breed),
    attributes: attributesFor(seed, breed.species, breed.id, breed.attributeRanges, archetype),
    now,
  });
}
