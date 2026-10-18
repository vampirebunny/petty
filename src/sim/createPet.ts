import { currentScores, potentialOf, rngSeed, temperamentOf, withDerived, zeroStats } from './attributes';
import {
  defaultSceneId,
  startingAsleep,
  startingAttention,
  startingDietQuality,
  startingNeeds,
  startingWeight,
} from './config';
import { vitalityTarget } from './care';
import type { LitterMate, PetState, Variant } from './types';

export function createLitter(seed: number, breedId: string): LitterMate[] {
  return ([0, 1, 2] as Variant[]).map((variant) => {
    const potential = potentialOf(seed, breedId, variant);
    return {
      variant,
      breedId,
      temperament: temperamentOf(variant),
      potential,
      current: currentScores(potential, 0),
    };
  });
}

export function createPet(
  seed: number,
  breedId: string,
  variant: Variant,
  now: number,
  name: string,
  id: string,
): PetState {
  const mate = createLitter(seed, breedId)[variant];
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
    seed,
    variant,
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
    potential: mate.potential,
    trained: zeroStats(),
    temperament: mate.temperament,
    drift: zeroStats(),
    level: 1,
    xp: 0,
    bond: 0,
    needs: { ...startingNeeds },
    asleep: startingAsleep,
    lastUpdatedAt: now,
    rngState: rngSeed(seed, variant),
  });
}
