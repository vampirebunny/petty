import type { OutfitSlot } from '../sim/types';
import { treatHungerDrop, treatMoodGain, treatWeightGain } from '../sim/config';

export type ItemKind = 'treat' | 'food' | 'second_wind' | 'outfit';

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

function outfit(
  slot: OutfitSlot,
  wearId: string,
  name: string,
  price: number | null,
  starter = false,
): CatalogItem {
  return {
    id: `${slot}:${wearId}`,
    name,
    kind: 'outfit',
    price: starter ? null : price,
    available: !starter,
    starter,
    slot,
    wearId,
  };
}

export const catalog: CatalogItem[] = [
  outfit('neckwear', 'collar', 'Red collar', null, true),
  outfit('neckwear', 'bandana', 'Blue bandana', null, true),
  outfit('neckwear', 'scarf', 'Yellow scarf', null, true),
  outfit('hat', 'beanie', 'Beanie', null, true),
  outfit('glasses', 'red-rim', 'Red rims', null, true),
  outfit('jacket', 'puffer', 'Puffer', null, true),
  outfit('boots', 'red', 'Red boots', null, true),
  outfit('neckwear', 'bell', 'Bell', 500),
  outfit('neckwear', 'bow', 'Bow', 500),
  outfit('neckwear', 'gold', 'Gold collar', 500),
  outfit('glasses', 'classic', 'Classic shades', 700),
  outfit('glasses', 'square', 'Square gold', 700),
  outfit('hat', 'party', 'Party hat', 1000),
  outfit('hat', 'top', 'Top hat', 1000),
  outfit('boots', 'rain', 'Rain boots', 1200),
  outfit('boots', 'sneaker', 'Sneakers', 1200),
  outfit('jacket', 'sweater', 'Knit sweater', 1600),
  outfit('jacket', 'rain', 'Raincoat', 1600),
  outfit('jacket', 'vest', 'Quilted vest', 1600),
  {
    id: 'biscuit',
    name: 'Treats',
    kind: 'treat',
    price: 30,
    available: true,
    effects: { casual: basicCasual, training: basicTraining },
  },
  {
    id: 'special',
    name: 'Special treat',
    kind: 'treat',
    price: null,
    available: false,
    effects: { casual: basicCasual, training: null },
  },
  {
    id: 'food_fish',
    name: 'Fish',
    kind: 'food',
    price: 50,
    available: true,
    effects: { mealMultipliers: { hunger: 1, weight: 1, energy: 1.2, xp: 1.5 }, moodBonus: 8 },
  },
  {
    id: 'food_gourmet',
    name: 'Gourmet',
    kind: 'food',
    price: 50,
    available: true,
    effects: { mealMultipliers: { hunger: 1, weight: 1, energy: 1.2, xp: 1.5 }, moodBonus: 12 },
  },
  {
    id: 'second_wind',
    name: 'Second Wind',
    kind: 'second_wind',
    price: 120,
    available: true,
    effects: { endRest: true },
  },
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
