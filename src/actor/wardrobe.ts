import type { OutfitSlot } from '../sim/types';

export type WearItem = {
  id: string;
  label: string;
  c?: string;
  d?: string;
};

export const wardrobe: Record<OutfitSlot, { label: string; items: WearItem[] }> = {
  collar: {
    label: 'Collar',
    items: [
      { id: 'none', label: 'None' },
      { id: 'red', label: 'Red', c: '#d64545' },
      { id: 'teal', label: 'Teal', c: '#2aa6a0' },
      { id: 'gold', label: 'Gold studs', c: '#e0b43c' },
    ],
  },
  bandana: {
    label: 'Bandana',
    items: [
      { id: 'none', label: 'None' },
      { id: 'red', label: 'Red polka', c: '#d64545', d: '#ffffff' },
      { id: 'blue', label: 'Blue', c: '#3b6fc4', d: '#cfe0ff' },
      { id: 'yellow', label: 'Yellow', c: '#e8c53a', d: '#fff4c2' },
    ],
  },
  glasses: {
    label: 'Glasses',
    items: [
      { id: 'none', label: 'None' },
      { id: 'classic', label: 'Classic shades', c: '#1b1b22' },
      { id: 'square', label: 'Square gold', c: '#e0b43c' },
    ],
  },
  hat: {
    label: 'Hat',
    items: [
      { id: 'none', label: 'None' },
      { id: 'beanie', label: 'Beanie', c: '#d64545' },
      { id: 'party', label: 'Party hat', c: '#8a5ad6' },
      { id: 'top', label: 'Top hat', c: '#26262c' },
    ],
  },
  coat: {
    label: 'Coat',
    items: [
      { id: 'none', label: 'None' },
      { id: 'sweater', label: 'Knit sweater', c: '#d64545', d: '#f4dede' },
      { id: 'rain', label: 'Raincoat', c: '#f2c230' },
      { id: 'vest', label: 'Quilted vest', c: '#3b6fc4' },
    ],
  },
  boots: {
    label: 'Boots',
    items: [
      { id: 'none', label: 'None' },
      { id: 'red', label: 'Red boots', c: '#d64545' },
      { id: 'rain', label: 'Rain boots', c: '#f2c230' },
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
  return item && item.c ? item : null;
}
