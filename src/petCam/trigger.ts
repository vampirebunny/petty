import { breedById } from '../actor/breeds';
import { wearItem } from '../actor/wardrobe';
import { furnitureOf, layoutOf } from '../db/playerHome';
import { readRestoreInProgress, readStandby } from '../db/accountMeta';
import { currentOwner } from '../db/currentOwner';
import { outfitsOwned } from '../economy/service';
import { stageOf } from '../sim/attributes';
import type { PetState } from '../sim/types';
import { readAgeGatePhase } from '../state/ageGatePhase';
import { authTransition } from '../state/sessionGate';
import { homeRooms } from '../ui/town/rooms';

import { decideShow } from './decide';
import { pickRecord } from './select';
import type { RoomId } from './types';
import { armWelcomeHomeSkip, queueCam, returnBlocked } from './session';
import { lastClipId, readBackgroundAt, readCamSeen } from './store';

function topsOf(): { id: string; shape: string }[] {
  const tops: { id: string; shape: string }[] = [];
  for (const item of outfitsOwned()) {
    if (item.slot !== 'jacket') {
      continue;
    }
    const wear = wearItem('jacket', item.id);
    if (wear) {
      tops.push({ id: item.id, shape: wear.shape });
    }
  }
  return tops;
}

export function offerPetCam(pet: PetState, now = Date.now()): void {
  if (returnBlocked() || readStandby() || readRestoreInProgress()) {
    return;
  }
  const transition = authTransition();
  if (transition === 'reauth' || transition === 'restoring' || transition === 'linking' || transition === 'deleting') {
    return;
  }
  const gate = readAgeGatePhase();
  if (gate === 'loading' || gate === 'unavailable') {
    return;
  }
  const leftAt = readBackgroundAt();
  if (leftAt == null) {
    return;
  }
  const species = breedById(pet.breedId)?.species === 'cat' ? 'cat' : 'dog';
  const rooms = homeRooms(species).map((room) => room.id as RoomId);
  const owner = pet.ownerId || currentOwner();
  const pieces = furnitureOf(owner);
  const placed = layoutOf(owner, species);
  const seen = readCamSeen();
  const record = pickRecord({
    pet: {
      species,
      breedId: pet.breedId,
      ageDays: pet.ageDays,
      stage: stageOf(pet.ageDays),
      look: pet.look ?? null,
      equipped: { ...pet.equipped },
      vitality: pet.vitality,
      weight: pet.weight,
    },
    rooms,
    pieces,
    placed,
    tops: topsOf(),
    lastClipId: lastClipId(),
    leftAt,
    returnedAt: now,
    rng: Math.random,
  });
  const choice = decideShow({
    awayMs: now - leftAt,
    seen,
    skipped: false,
    eligible: record != null,
    roll: Math.random(),
  });
  if (choice !== 'show' || !record) {
    return;
  }
  if (!seen) {
    armWelcomeHomeSkip();
  }
  queueCam(record);
}
