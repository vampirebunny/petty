import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyCloset, withStarter, type OwnedItem, type WardrobeCloset } from '../actor/closet';
import { outfitSlots } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';

function keyFor(ownerId: string): string {
  return `petty.wardrobe.${ownerId}`;
}

function isSlot(value: string): value is OutfitSlot {
  return (outfitSlots as string[]).includes(value);
}

function isCloset(value: unknown): value is WardrobeCloset {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const owned = (value as WardrobeCloset).owned;
  return (
    Array.isArray(owned) &&
    owned.every((item) => !!item && typeof item === 'object' && isSlot((item as OwnedItem).slot) && typeof (item as OwnedItem).id === 'string')
  );
}

export async function loadCloset(ownerId: string, equipped: Equipped): Promise<WardrobeCloset> {
  const raw = await AsyncStorage.getItem(keyFor(ownerId));
  let stored = emptyCloset();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isCloset(parsed)) {
        stored = parsed;
      }
    } catch {
      stored = emptyCloset();
    }
  }
  const next = withStarter(stored, equipped);
  if (JSON.stringify(next) !== JSON.stringify(stored)) {
    await saveCloset(ownerId, next);
  }
  return next;
}

export async function saveCloset(ownerId: string, closet: WardrobeCloset): Promise<void> {
  await AsyncStorage.setItem(keyFor(ownerId), JSON.stringify(closet));
}
