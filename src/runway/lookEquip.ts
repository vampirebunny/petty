import { wearItem, type WearItem } from '../actor/wardrobe';
import type { Equipped, OutfitSlot } from '../sim/types';
import { costumeById } from './catalog';
import { costumeToOutfit, wearFromFrozen, type FrozenLook, type FrozenPiece } from './types';

const outfitSlots: OutfitSlot[] = ['hat', 'glasses', 'neckwear', 'jacket', 'boots'];

function isOutfitSlot(slot: string): slot is OutfitSlot {
  return (outfitSlots as string[]).includes(slot);
}

export type EquipResult = {
  equipped: Equipped;
  wearDefs: Partial<Record<OutfitSlot, WearItem>>;
  /** Costume-only back piece (cape / wings / jetpack). */
  backWear?: WearItem;
};

/** Build equipped + wearDefs so Closet and costume pieces both draw. */
export function equipFromPieces(pieces: readonly FrozenPiece[]): EquipResult {
  const equipped: Equipped = {};
  const wearDefs: Partial<Record<OutfitSlot, WearItem>> = {};
  let backWear: WearItem | undefined;
  for (const piece of pieces) {
    if (piece.slot === 'back') {
      backWear = {
        id: piece.id,
        slot: 'jacket',
        label: piece.label,
        shape: piece.shape,
        colorway: piece.colorway,
        costume: true,
      };
      continue;
    }
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
  return { equipped, wearDefs, backWear };
}

export function equipFromFrozenLook(look: FrozenLook | undefined): EquipResult {
  return equipFromPieces(look?.pieces ?? []);
}

/** Live backstage draft → same shape OutfitPreview expects. */
export function equipFromDraft(
  wardrobe: Equipped,
  costumeIds: readonly string[],
): EquipResult {
  const equipped: Equipped = { ...wardrobe };
  const wearDefs: Partial<Record<OutfitSlot, WearItem>> = {};
  let backWear: WearItem | undefined;
  for (const costumeId of costumeIds) {
    const piece = costumeById(costumeId);
    if (!piece) {
      continue;
    }
    const slot = costumeToOutfit[piece.slot];
    if (slot === 'back') {
      backWear = {
        id: piece.id,
        slot: 'jacket',
        label: piece.name,
        shape: piece.shape,
        colorway: { ...piece.colorway },
        costume: true,
      };
      continue;
    }
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
  return { equipped, wearDefs, backWear };
}
