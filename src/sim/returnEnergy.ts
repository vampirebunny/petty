import type { Cue, PetState } from './types';

// A return after this long away from the app fills energy back to full.
export const returnEnergyAfterMs = 3 * 60 * 60 * 1000;

// Applies a full energy refill, and hands a visible gain to the same +energy pop sleep uses.
// Gains under half a point fill quietly, since the pop label would round to +0.
export function openReturnFollowUp(
  pet: PetState,
  greet: { elapsedH: number } | null,
  fillEnergy: boolean,
): { pet: PetState; cue?: Cue } {
  let next = pet;
  let energyGain: number | undefined;
  if (fillEnergy) {
    const gain = 100 - pet.needs.energy;
    if (gain > 0) {
      next = { ...pet, needs: { ...pet.needs, energy: 100 } };
      if (Math.round(gain) >= 1) {
        energyGain = gain;
      }
    }
  }
  if (!greet && energyGain == null) {
    return { pet: next };
  }
  return {
    pet: next,
    cue: {
      kind: greet ? 'greet' : 'none',
      ...(greet ? { elapsedH: greet.elapsedH } : {}),
      ...(energyGain != null ? { energyGain } : {}),
    },
  };
}
