import { wearItem, type WearItem } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';
import { costumeById } from './catalog';
import { costumeToOutfit, wearFromFrozen, type FrozenLook, type FrozenPiece } from './types';

const outfitSlots: OutfitSlot[] = ['hat', 'glasses', 'neckwear', 'jacket', 'boots'];

function isOutfitSlot(slot: string): slot is OutfitSlot {
  return (outfitSlots as string[]).includes(slot);
}

/** Build equipped + wearDefs so Closet and costume pieces both draw. */
export function equipFromPieces(pieces: readonly FrozenPiece[]): {
  equipped: Equipped;
  wearDefs: Partial<Record<OutfitSlot, WearItem>>;
} {
  const equipped: Equipped = {};
  const wearDefs: Partial<Record<OutfitSlot, WearItem>> = {};
  for (const piece of pieces) {
    const wear = wearFromFrozen(piece);
    if (!isOutfitSlot(wear.slot)) {
      continue;
    }
    equipped[wear.slot] = wear.id;
    const known = wearItem(wear.slot, wear.id);
    if (!known || piece.kind === 'costume') {
      wearDefs[wear.slot] = wear;
    }
  }
  return { equipped, wearDefs };
}

export function equipFromFrozenLook(look: FrozenLook | undefined): {
  equipped: Equipped;
  wearDefs: Partial<Record<OutfitSlot, WearItem>>;
} {
  return equipFromPieces(look?.pieces ?? []);
}

/** Live backstage draft → same shape OutfitPreview expects. */
export function equipFromDraft(
  wardrobe: Equipped,
  costumeIds: readonly string[],
): { equipped: Equipped; wearDefs: Partial<Record<OutfitSlot, WearItem>> } {
  const equipped: Equipped = { ...wardrobe };
  const wearDefs: Partial<Record<OutfitSlot, WearItem>> = {};
  for (const costumeId of costumeIds) {
    const piece = costumeById(costumeId);
    if (!piece) {
      continue;
    }
    const slot = costumeToOutfit[piece.slot];
    if (!isOutfitSlot(slot)) {
      continue;
    }
    const wear = wearFromFrozen({
      id: piece.id,
      slot,
      kind: 'costume',
      label: piece.name,
      shape: piece.shape,
      colorway: { ...piece.colorway },
    });
    equipped[slot] = wear.id;
    wearDefs[slot] = wear;
  }
  return { equipped, wearDefs };
}
