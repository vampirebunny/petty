import type { SkyState } from '../actor/sky';
import { parkFinds, type ParkFindRarity } from '../sim/parkFindsConfig';
import { catalogForSpecies } from './catalog';
import { conditionTrue, type ConditionOverrides } from './conditions';
import type { ParkFindCatalogRow } from './types';

export type RollDebug = {
  forceRarity?: ParkFindRarity | null;
  forceItemId?: string | null;
  overrides?: ConditionOverrides;
};

function pickWeighted(rng: () => number): ParkFindRarity {
  const weights = parkFinds.rarityWeights;
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  let roll = rng() * total;
  if ((roll -= weights.common) < 0) return 'common';
  if ((roll -= weights.uncommon) < 0) return 'uncommon';
  if ((roll -= weights.rare) < 0) return 'rare';
  return 'legendary';
}

/** Fall back toward more common rarities when the rolled tier has no eligible items. */
function raritiesFrom(start: ParkFindRarity): ParkFindRarity[] {
  const order: ParkFindRarity[] = ['legendary', 'rare', 'uncommon', 'common'];
  return order.slice(order.indexOf(start));
}

/** Brief: pick rarity, then random eligible of that rarity; if none, fall back to next more common. */
export function rollParkFind(
  species: 'dog' | 'cat',
  sky: SkyState,
  rng: () => number,
  debug: RollDebug = {},
): ParkFindCatalogRow | null {
  const pool = catalogForSpecies(species).filter((row) =>
    conditionTrue(row, sky, debug.overrides ?? {}),
  );
  if (pool.length === 0) {
    return null;
  }
  if (debug.forceItemId) {
    return pool.find((row) => row.id === debug.forceItemId) ?? pool[0] ?? null;
  }
  const start = debug.forceRarity ?? pickWeighted(rng);
  for (const rarity of raritiesFrom(start)) {
    const matches = pool.filter((row) => row.rarity === rarity);
    if (matches.length > 0) {
      return matches[Math.floor(rng() * matches.length)] ?? null;
    }
  }
  return pool[Math.floor(rng() * pool.length)] ?? null;
}
