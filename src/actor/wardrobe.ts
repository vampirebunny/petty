import type { OutfitSlot } from '../sim/types';

export type WearItem = {
  id: string;
  label: string;
  c: string;
  d?: string;
};

export const wardrobe: Record<OutfitSlot, { label: string; items: WearItem[] }> = {
  hat: {
    label: 'Hat',
    items: [
      { id: 'beanie', label: 'Beanie', c: '#2f9e6b' },
      { id: 'party', label: 'Party hat', c: '#8a5ad6', d: '#ffd34d' },
      { id: 'top', label: 'Top hat', c: '#26262c', d: '#f4dede' },
    ],
  },
  glasses: {
    label: 'Glasses',
    items: [
      { id: 'classic', label: 'Classic shades', c: '#1b1b22' },
      { id: 'square', label: 'Square gold', c: '#e0b43c' },
      { id: 'red-rim', label: 'Red rims', c: '#d64545' },
    ],
  },
  neckwear: {
    label: 'Neckwear',
    items: [
      { id: 'collar', label: 'Red collar', c: '#d64545', d: '#f0c94a' },
      { id: 'bandana', label: 'Blue bandana', c: '#3b6fc4', d: '#ffffff' },
      { id: 'scarf', label: 'Yellow scarf', c: '#e8c53a' },
      { id: 'bell', label: 'Bell', c: '#6b3a2a', d: '#f0c94a' },
      { id: 'bow', label: 'Bow', c: '#e85a8c' },
      { id: 'gold', label: 'Gold collar', c: '#e0b43c', d: '#fff3c4' },
    ],
  },
  jacket: {
    label: 'Jacket',
    items: [
      { id: 'sweater', label: 'Knit sweater', c: '#d64545', d: '#f4dede' },
      { id: 'rain', label: 'Raincoat', c: '#f2c230' },
      { id: 'vest', label: 'Quilted vest', c: '#3b6fc4' },
      { id: 'puffer', label: 'Puffer', c: '#f28c28', d: '#ffe0c2' },
    ],
  },
  boots: {
    label: 'Boots',
    items: [
      { id: 'red', label: 'Red boots', c: '#d64545', d: '#f7f7f7' },
      { id: 'rain', label: 'Rain boots', c: '#f2c230', d: '#f7f7f7' },
      { id: 'sneaker', label: 'Sneakers', c: '#f4f4f4', d: '#d64545' },
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
  return item?.c ? item : null;
}

export function jacketHasSleeves(id: string): boolean {
  return id === 'sweater' || id === 'rain' || id === 'puffer';
}
