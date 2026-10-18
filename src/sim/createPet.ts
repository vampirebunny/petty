import { rngSeed, withDerived, zeroStats } from './attributes';
import {
  defaultSceneId,
  startingAsleep,
  startingAttention,
  startingDietQuality,
  startingNeeds,
  startingWeight,
} from './config';
import { vitalityTarget } from './care';
import { startingCurrent } from './offers';
import type { Look, PetAttributes, PetState } from './types';

export type NewPet = {
  id: string;
  name: string;
  breedId: string;
  look: Look;
  // The picked attribute set from `attributesFor`. Potential is stored and never recomputed.
  attributes: PetAttributes;
  now: number;
};

// A brand-new pet from the adoption choices. Pure: the same inputs always return the same pet.
// Current restarts at the starting fraction of the stored potential, so a debug reset can reuse
// the stored attributes without regenerating them from today's breed ranges.
export function createPet({ id, name, breedId, look, attributes, now }: NewPet): PetState {
  const careWindow = [
    {
      day: 0,
      dietQuality: startingDietQuality,
      exercise: 0,
      play: 0,
      attention: startingAttention,
    },
  ];
  return withDerived({
    id,
    name,
    breedId,
    ageDays: 0,
    maturity: 0,
    vitality: vitalityTarget(careWindow),
    careWindow,
    weight: startingWeight,
    weightAppliedAt: now,
    bornAt: now,
    sceneId: defaultSceneId,
    equipped: {},
    look: { ...look },
    attributes: {
      seed: attributes.seed,
      rulesVersion: attributes.rulesVersion,
      archetype: attributes.archetype,
      potential: { ...attributes.potential },
      current: startingCurrent(attributes.potential),
    },
    drift: zeroStats(),
    level: 1,
    xp: 0,
    bond: 0,
    needs: { ...startingNeeds },
    asleep: startingAsleep,
    lastUpdatedAt: now,
    rngState: rngSeed(attributes.seed, attributes.archetype),
  });
}
