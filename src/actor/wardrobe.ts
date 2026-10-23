import type { OutfitSlot } from '../sim/types';

/** Filled in by the pattern brief. Until then every item draws as solid `c`. */
export type PatternId = string;

export type Colorway = { c: string; d?: string; pattern?: PatternId };

export type NeckwearShape = 'collar' | 'bandana' | 'scarf' | 'bow';
export type JacketShape = 'puffer' | 'sweater' | 'hoodie' | 'raincoat' | 'vest';
export type ShapeId = NeckwearShape | JacketShape | string;

export type WearItem = {
  id: string;
  slot: OutfitSlot;
  label: string;
  shape: ShapeId;
  colorway: Colorway;
};

function wear(
  slot: OutfitSlot,
  id: string,
  label: string,
  shape: ShapeId,
  c: string,
  d?: string,
): WearItem {
  return { id, slot, label, shape, colorway: d ? { c, d } : { c } };
}

export const wardrobe: Record<OutfitSlot, { label: string; items: WearItem[] }> = {
  hat: {
    label: 'Hat',
    items: [
      wear('hat', 'beanie', 'Beanie', 'beanie', '#2f9e6b'),
      wear('hat', 'party', 'Party hat', 'party', '#8a5ad6', '#ffd34d'),
      wear('hat', 'top', 'Top hat', 'top', '#26262c', '#f4dede'),
    ],
  },
  glasses: {
    label: 'Glasses',
    items: [
      wear('glasses', 'classic', 'Classic shades', 'classic', '#1b1b22'),
      wear('glasses', 'square', 'Square gold', 'square', '#e0b43c'),
      wear('glasses', 'red-rim', 'Red rims', 'red-rim', '#d64545'),
    ],
  },
  neckwear: {
    label: 'Neckwear',
    items: [
      wear('neckwear', 'collar', 'Red collar', 'collar', '#d64545', '#f0c94a'),
      wear('neckwear', 'bandana', 'Blue bandana', 'bandana', '#3b6fc4'),
      wear('neckwear', 'scarf', 'Yellow scarf', 'scarf', '#e8c53a'),
      wear('neckwear', 'bell', 'Bell', 'collar', '#6b3a2a', '#f0c94a'),
      wear('neckwear', 'bow', 'Bow', 'bow', '#e85a8c'),
      wear('neckwear', 'gold', 'Gold collar', 'collar', '#e0b43c', '#fff3c4'),
    ],
  },
  jacket: {
    label: 'Jacket',
    items: [
      wear('jacket', 'sweater', 'Knit sweater', 'sweater', '#d64545', '#f4dede'),
      wear('jacket', 'rain', 'Raincoat', 'raincoat', '#f2c230'),
      wear('jacket', 'vest', 'Quilted vest', 'vest', '#3b6fc4'),
      wear('jacket', 'puffer', 'Puffer', 'puffer', '#f28c28', '#ffe0c2'),
      wear('jacket', 'hoodie', 'Hoodie', 'hoodie', '#FF9FCB', '#8A5AD6'),
    ],
  },
  boots: {
    label: 'Boots',
    items: [
      wear('boots', 'red', 'Red boots', 'red', '#d64545'),
      wear('boots', 'rain', 'Rain boots', 'rain', '#f2c230', '#f7f7f7'),
      wear('boots', 'sneaker', 'Sneakers', 'sneaker', '#f4f4f4', '#d64545'),
    ],
  },
};

export const outfitSlots = Object.keys(wardrobe) as OutfitSlot[];

export function wearItem(slot: OutfitSlot, id: string | undefined): WearItem | null {
  if (!id || id === 'none') {
    return null;
  }
  const lookup = slot === 'glasses' && id === 'round' ? 'square' : id;
  const item = wardrobe[slot].items.find((entry) => entry.id === lookup);
  return item?.colorway.c ? item : null;
}

export function jacketHasSleeves(item: { shape: string } | string): boolean {
  const shape = typeof item === 'string' ? wearItem('jacket', item)?.shape : item.shape;
  return shape === 'sweater' || shape === 'raincoat' || shape === 'hoodie';
}
