import type { Colorway, WearItem } from '../actor/wardrobe';
import type { Look, OutfitSlot } from '../sim/types';
import type { RunwayStyle } from './config';

/** Closet slots plus the costume-only back slot. */
export type CostumeSlot = OutfitSlot | 'back' | 'hat' | 'glasses' | 'neckwear' | 'jacket' | 'boots';

export type RunwayCostumeSlot = 'head' | 'face' | 'neck' | 'body' | 'back' | 'feet';

export const costumeToOutfit: Record<RunwayCostumeSlot, CostumeSlot> = {
  head: 'hat',
  face: 'glasses',
  neck: 'neckwear',
  body: 'jacket',
  back: 'back',
  feet: 'boots',
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
  submissions: RunwaySubmission[];
  /** Player-facing list order: self first for the host viewer. */
  hidden?: boolean;
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
  };
}
