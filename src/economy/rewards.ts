import { economyConfig } from './economyConfig';

export function competitionAward(place: number, didFinish: boolean): number {
  if (!didFinish || place < 1) {
    return 0;
  }
  return place <= 3 ? economyConfig.competition.top3 : economyConfig.competition.finish;
}

export function payUpToCap(award: number, already: number, cap: number): number {
  if (award <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(award, cap - already));
}

export function secondWindEnergy(current: number, add = economyConfig.secondWind.energy): { next: number; gained: number } {
  const gained = Math.max(0, Math.min(add, 100 - current));
  return { next: current + gained, gained };
}

/** Stored catalog price. Half-steps round away from zero to the next 50. */
export function tierPrice(base: number, tier: 'standard' | 'exclusive' | 'limited'): number {
  const multiplier =
    tier === 'exclusive' ? economyConfig.exclusiveMultiplier : tier === 'limited' ? economyConfig.limitedMultiplier : 1;
  return Math.round((base * multiplier) / 50) * 50;
}
