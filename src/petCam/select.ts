import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import { gameplayConfig } from '../sim/gameplayConfig';

import { durationOf, eligibleIds, isNightAt, preferredTop } from './clips';
import { recordedAt } from './decide';
import type { ClipId, ClipRecord, PetSnap, RoomId } from './types';
import { clipVersion } from './types';

export type TopItem = { id: string; shape: string };

export type PickInput = {
  pet: PetSnap;
  rooms: readonly RoomId[];
  pieces: FurniturePiece[];
  placed: FurniturePlacement[];
  tops: readonly TopItem[];
  lastClipId: string | null;
  leftAt: number;
  returnedAt: number;
  rng: () => number;
};

function weighted(ids: readonly ClipId[], rng: () => number): ClipId {
  const weights = gameplayConfig.petCam.clips;
  let total = 0;
  for (const id of ids) {
    total += weights[id].weight;
  }
  let roll = rng() * total;
  for (const id of ids) {
    roll -= weights[id].weight;
    if (roll <= 0) {
      return id;
    }
  }
  return ids[ids.length - 1];
}

/** Drops the previous clip. Nothing is left when that was the only eligible one. */
export function firstClip(
  rooms: readonly { room: RoomId; ids: readonly ClipId[] }[],
  lastClipId: string | null,
  rng: () => number,
): { room: RoomId; clipId: ClipId } | null {
  const choices: { room: RoomId; ids: ClipId[] }[] = [];
  for (const entry of rooms) {
    const ids = lastClipId ? entry.ids.filter((id) => id !== lastClipId) : [...entry.ids];
    if (ids.length > 0) {
      choices.push({ room: entry.room, ids });
    }
  }
  if (choices.length === 0) {
    return null;
  }
  const roomPick = choices[Math.floor(rng() * choices.length)];
  return { room: roomPick.room, clipId: weighted(roomPick.ids, rng) };
}

export function pickRecord(input: PickInput): ClipRecord | null {
  const rooms = input.rooms.map((room) => ({
    room,
    ids: eligibleIds(input.pet.species, room, input.pieces, input.placed, input.tops),
  }));
  const picked = firstClip(rooms, input.lastClipId, input.rng);
  if (!picked) {
    return null;
  }
  const roomPick = { room: picked.room };
  const clipId = picked.clipId;
  const when = recordedAt(input.leftAt, input.returnedAt, input.rng);
  if (when == null) {
    return null;
  }
  const seed = Math.floor(input.rng() * 1_000_000_003);
  const top = clipId === 'sweater' ? preferredTop(input.tops, input.rng) : null;
  const equipped = { ...input.pet.equipped };
  if (top) {
    equipped.jacket = top.id;
  }
  return {
    clipId,
    clipVersion,
    seed,
    roomId: roomPick.room,
    recordedAt: when,
    isNight: isNightAt(when),
    pet: { ...input.pet, equipped },
    pieces: input.pieces.map((piece) => ({ ...piece })),
    placed: input.placed.map((place) => ({ ...place })),
    sweaterItemId: top?.id ?? null,
  };
}

export function clipLength(id: ClipId): number {
  return durationOf(id);
}
