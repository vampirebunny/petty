import type { Equipped, Look, OutfitSlot, Stats } from '../sim/types';

export type FriendPet = {
  petId?: string;
  name: string;
  breedId: string;
  look: Look;
  equipped: Equipped;
  // Closet pieces this player owns. Missing on a card saved before that list existed.
  owned?: { slot: OutfitSlot; id: string }[];
  ageDays: number;
  weight: number;
  vitality: number;
  seed: number;
  originArchetype: 'athlete' | 'thinker' | 'charmer';
  attributes: Stats;
  potential: Stats;
};

export type FriendRow = {
  userId: string;
  handle: string;
  pet: FriendPet | null;
  requestId?: string;
  createdAt?: string;
};

export type LookupResult =
  | { ok: false; error: string }
  | { ok: true; found: false }
  | {
      ok: true;
      found: true;
      state: 'none' | 'request_sent' | 'request_received' | 'friends' | 'cooldown';
      userId: string;
      handle: string;
      pet: FriendPet | null;
      requestId?: string;
    };
