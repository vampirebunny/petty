import { startingAsleep, startingNeeds } from './config';
import type { PetState } from './types';

export function createPet(seed: number, now: number): PetState {
  return {
    needs: { ...startingNeeds },
    asleep: startingAsleep,
    lastUpdatedAt: now,
    rngState: seed,
  };
}
