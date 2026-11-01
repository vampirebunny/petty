import type { Colorway, WearItem } from '../actor/wardrobe';
import type { Look, OutfitSlot } from '../sim/types';
import type { RunwayStyle } from './config';

/** Closet slots plus the costume-only back slot. Catalog slots match WearItem slots. */
export type CostumeSlot = OutfitSlot | 'back';

/** Slots used by the 23-piece runway costume catalog. */
export type RunwayCostumeSlot = 'hat' | 'glasses' | 'neckwear' | 'jacket' | 'back' | 'boots';

export const costumeToOutfit: Record<RunwayCostumeSlot, CostumeSlot> = {
  hat: 'hat',
  glasses: 'glasses',
  neckwear: 'neckwear',
  jacket: 'jacket',
  back: 'back',
  boots: 'boots',
};

export type FrozenPiece = {
  id: string;
  slot: CostumeSlot;
  kind: 'wardrobe' | 'costume';
  label: string;
  shape: string;
  colorway: Colorway;
  patternParts?: readonly string[];
  lensTint?: string;
};

export type FrozenLook = {
  lookNumber: 1 | 2 | 3;
  pieces: FrozenPiece[];
};

export type RunwayPetSnap = {
  snapshotId: string;
  id?: string;
  petId?: string;
  source: 'self' | 'npc' | 'friend';
  name: string;
  species: 'dog' | 'cat';
  breedId: string;
  look: Look;
  ageDays: number;
  weight: number;
  style?: RunwayStyle;
};

export type RunwaySubmission = {
  submissionId: string;
  playerId?: string;
  pet: RunwayPetSnap;
  looks: FrozenLook[];
  submittedAt: number;
  claimedCostumeIds: string[];
};

export type RunwayShowMode = 'solo' | 'friends';

export type LocalRunwayShow = {
  id: string;
  mode: RunwayShowMode;
  themeId: string;
  trackId: string;
  hostPlayerId?: string;
  createdAt: number;
  deadlineAt?: number;
  /** Friend drip clock; defaults to createdAt when absent. */
  invitesSentAt?: number;
  submissions: RunwaySubmission[];
  /** Seeded solo rack ids (stable for replay / NPC leftovers). */
  soloRackIds?: string[];
  /** Player-facing list order: self first for the host viewer. */
  hidden?: boolean;
  /** Set after a successful record_solo_runway_walk so wrap retries do not double-grant. */
  awardedAt?: number;
};

export type RunwaySave = {
  history: LocalRunwayShow[];
};

export function wearFromFrozen(piece: FrozenPiece): WearItem {
  return {
    id: piece.id,
    slot: piece.slot === 'back' ? 'jacket' : piece.slot,
    label: piece.label,
    shape: piece.shape,
    colorway: piece.colorway,
    ...(piece.patternParts ? { patternParts: piece.patternParts } : {}),
    ...(piece.lensTint ? { lensTint: piece.lensTint } : {}),
    ...(piece.kind === 'costume' ? { costume: true } : {}),
  };
}
