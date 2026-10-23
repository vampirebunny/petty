import type { OutfitSlot } from '../sim/types';
import { treatHungerDrop, treatMoodGain, treatWeightGain } from '../sim/config';

export type ItemKind = 'treat' | 'food' | 'second_wind' | 'outfit' | 'toy';

export type TreatEffects = { hunger: number; weight: number; mood: number };

export type CatalogItem = {
  id: string;
  name: string;
  kind: ItemKind;
  price: number | null;
  available: boolean;
  starter?: boolean;
  slot?: OutfitSlot;
  wearId?: string;
  effects?: {
    casual?: TreatEffects;
    training?: TreatEffects | null;
    mealMultipliers?: { hunger: number; weight: number; energy: number; xp: number };
    moodBonus?: number;
    endRest?: boolean;
  };
};

const basicCasual: TreatEffects = { hunger: -treatHungerDrop, weight: treatWeightGain, mood: treatMoodGain };
const basicTraining: TreatEffects = {
  hunger: -treatHungerDrop * 0.25,
  weight: treatWeightGain * 0.25,
  mood: treatMoodGain,
};

// Shop prices live in the shop catalog. What an item does stays here.
function outfit(slot: OutfitSlot, wearId: string, name: string, starter = false): CatalogItem {
  return {
    id: `${slot}:${wearId}`,
    name,
    kind: 'outfit',
    price: null,
    available: !starter,
    starter,
    slot,
    wearId,
  };
}

export const catalog: CatalogItem[] = [
  outfit('neckwear', 'collar', 'Red collar', true),
  outfit('neckwear', 'bandana', 'Blue bandana', true),
  outfit('neckwear', 'scarf', 'Yellow scarf', true),
  outfit('hat', 'beanie', 'Beanie', true),
  outfit('glasses', 'red-rim', 'Red rims', true),
  outfit('jacket', 'puffer', 'Puffer', true),
  outfit('boots', 'red', 'Red boots', true),
  outfit('neckwear', 'bell', 'Bell'),
  outfit('neckwear', 'bow', 'Bow'),
  outfit('neckwear', 'gold', 'Gold collar'),
  outfit('glasses', 'classic', 'Classic shades'),
  outfit('glasses', 'square', 'Square gold'),
  outfit('hat', 'party', 'Party hat'),
  outfit('hat', 'top', 'Top hat'),
  outfit('boots', 'rain', 'Rain boots'),
  outfit('boots', 'sneaker', 'Sneakers'),
  outfit('jacket', 'sweater', 'Knit sweater'),
  outfit('jacket', 'rain', 'Raincoat'),
  outfit('jacket', 'vest', 'Quilted vest'),
  outfit('jacket', 'hoodie', 'Hoodie'),
  {
    id: 'biscuit',
    name: 'Treats',
    kind: 'treat',
    price: null,
    available: true,
    effects: { casual: basicCasual, training: basicTraining },
  },
  {
    id: 'special',
    name: 'Special treat',
    kind: 'treat',
    price: null,
    available: true,
    effects: { casual: basicCasual, training: null },
  },
  {
    id: 'food_fish',
    name: 'Fish',
    kind: 'food',
    price: null,
    available: true,
    effects: { mealMultipliers: { hunger: 1, weight: 1, energy: 1.2, xp: 1.5 }, moodBonus: 8 },
  },
  {
    id: 'food_gourmet',
    name: 'Gourmet',
    kind: 'food',
    price: null,
    available: true,
    effects: { mealMultipliers: { hunger: 1, weight: 1, energy: 1.2, xp: 1.5 }, moodBonus: 12 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    kind: 'second_wind',
    price: null,
    available: true,
    effects: { endRest: true },
  },
  { id: 'frisbee', name: 'Frisbee', kind: 'toy', price: null, available: true },
  { id: 'squeaky', name: 'Squeaky', kind: 'toy', price: null, available: true },
  { id: 'yarn', name: 'Yarn', kind: 'toy', price: null, available: true },
];

const byId = new Map(catalog.map((item) => [item.id, item]));

export function catalogItem(id: string): CatalogItem | null {
  return byId.get(id) ?? null;
}

export function starterOutfits(): CatalogItem[] {
  return catalog.filter((item) => item.starter);
}

export function storeItems(): CatalogItem[] {
  return catalog.filter((item) => item.available && item.price != null);
}
