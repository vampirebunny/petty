import type { Equipped, OutfitSlot } from '../sim/types';

import { outfitSlots, wearItem } from './wardrobe';

export type OwnedItem = { slot: OutfitSlot; id: string };

export type WardrobeCloset = { owned: OwnedItem[] };

export const starterCloset: readonly OwnedItem[] = [
  { slot: 'neckwear', id: 'collar' },
  { slot: 'neckwear', id: 'bandana' },
  { slot: 'neckwear', id: 'scarf' },
  { slot: 'hat', id: 'beanie' },
  { slot: 'glasses', id: 'red-rim' },
  { slot: 'jacket', id: 'puffer' },
  { slot: 'boots', id: 'red' },
];

function readId(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value !== 'none' ? value : undefined;
}

// Old saves used collar, bandana, and coat. Bandana wins when both neck pieces were worn.
export function migrateEquipped(raw: object | null | undefined): Equipped {
  const src = (raw ?? {}) as Record<string, unknown>;
  const next: Equipped = {};
  for (const slot of outfitSlots) {
    const item = wearItem(slot, readId(src, slot));
    if (item) {
      next[slot] = item.id;
    }
  }
  if (!next.neckwear) {
    const bandana = readId(src, 'bandana');
    const collar = readId(src, 'collar');
    if (bandana) {
      next.neckwear = 'bandana';
    } else if (collar === 'gold') {
      next.neckwear = 'gold';
    } else if (collar) {
      next.neckwear = 'collar';
    }
  }
  if (!next.jacket) {
    const coat = readId(src, 'coat');
    if (coat && wearItem('jacket', coat)) {
      next.jacket = coat;
    }
  }
  return next;
}

function hasItem(owned: OwnedItem[], slot: OutfitSlot, id: string): boolean {
  return owned.some((item) => item.slot === slot && item.id === id);
}

export function withStarter(closet: WardrobeCloset, equipped: Equipped): WardrobeCloset {
  const owned = closet.owned.filter((item) => outfitSlots.includes(item.slot) && wearItem(item.slot, item.id));
  for (const item of starterCloset) {
    if (!hasItem(owned, item.slot, item.id)) {
      owned.push({ ...item });
    }
  }
  for (const slot of outfitSlots) {
    const id = equipped[slot];
    if (id && wearItem(slot, id) && !hasItem(owned, slot, id)) {
      owned.push({ slot, id });
    }
  }
  return { owned };
}

export function emptyCloset(): WardrobeCloset {
  return { owned: [] };
}
