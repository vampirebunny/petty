import type { Species } from '../types';

// Senior graying. It follows age only: care, vitality and rejuvenation never change it.
export type GrayConfig = {
  // Age in days where graying starts and where it is complete.
  startDay: number;
  endDay: number;
  // Strongest effect for the species (cats show about 0.4 of a dog).
  max: number;
  // Level (0..1) at which each region starts to fade in. A null region never grays.
  from: { muzzle: number; brows: number | null; chest: number | null };
};

export const grayingBySpecies: Record<Species, GrayConfig> = {
  dog: { startDay: 550, endDay: 850, max: 1, from: { muzzle: 0, brows: 0.4, chest: 0.75 } },
  cat: { startDay: 550, endDay: 850, max: 0.4, from: { muzzle: 0, brows: null, chest: null } },
};

export type GrayAmounts = {
  // 0..1 age curve, before the species cap.
  level: number;
  muzzle: number;
  brows: number;
  chest: number;
};

function smooth(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

// The S-curve of graying by age, 0 before startDay and 1 from endDay.
export function grayLevelOf(species: Species, ageDays: number): number {
  const config = grayingBySpecies[species];
  return smooth((ageDays - config.startDay) / (config.endDay - config.startDay));
}

// Each region's frost amount (already scaled by the species cap), faded in from its own threshold.
export function grayAmountsOf(species: Species, ageDays: number): GrayAmounts {
  const config = grayingBySpecies[species];
  const level = grayLevelOf(species, ageDays);
  const region = (from: number | null): number =>
    from == null ? 0 : smooth((level - from) / Math.max(0.0001, 1 - from)) * config.max;
  return {
    level,
    muzzle: region(config.from.muzzle),
    brows: region(config.from.brows),
    chest: region(config.from.chest),
  };
}
