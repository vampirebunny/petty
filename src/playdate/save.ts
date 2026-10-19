import { playdateConfig } from './config';
import { applyPlaydateRewards } from './rewards';
import type { PetSnapshot, PlaydateRecord, PlaydateSave, Relationship } from './types';
import type { PetState } from '../sim/types';

export function emptyPlaydateSave(): PlaydateSave {
  return {
    cast: [],
    relationships: {},
    history: [],
    lastPlaydateCompletedAt: null,
  };
}

export function relationshipFor(save: PlaydateSave, petId: string, partnerId: string): Relationship | null {
  return save.relationships[petId]?.[partnerId] ?? null;
}

export function rememberPlaydate(
  save: PlaydateSave,
  record: PlaydateRecord,
  completedAt: number,
): { save: PlaydateSave; applied: boolean } {
  if (save.history.some((entry) => entry.playdateId === record.playdateId)) {
    return { save, applied: false };
  }
  const petId = record.petA.petId ?? '';
  const partnerId = record.petB.snapshotId;
  const current = save.relationships[petId]?.[partnerId] ?? {
    bond: 0,
    playdateCount: 0,
    lastPlaydateAt: record.createdAt,
  };
  const relationship: Relationship = {
    bond: Math.min(playdateConfig.bondMax, current.bond + record.outcome.bondDelta),
    playdateCount: current.playdateCount + 1,
    lastPlaydateAt: record.createdAt,
  };
  return {
    save: {
      ...save,
      relationships: {
        ...save.relationships,
        [petId]: { ...save.relationships[petId], [partnerId]: relationship },
      },
      history: [record, ...save.history].slice(0, playdateConfig.historyLimit),
      lastPlaydateCompletedAt: completedAt,
    },
    applied: true,
  };
}

export function settlePlaydate(
  save: PlaydateSave,
  pet: PetState,
  record: PlaydateRecord,
  completedAt: number,
): { save: PlaydateSave; pet: PetState; applied: boolean } {
  const remembered = rememberPlaydate(
    save,
    { ...record, petA: { ...record.petA, petId: record.petA.petId ?? pet.id } },
    completedAt,
  );
  if (!remembered.applied) {
    return { save, pet, applied: false };
  }
  return {
    save: remembered.save,
    pet: applyPlaydateRewards(pet, record.outcome),
    applied: true,
  };
}

export function clearPet(save: PlaydateSave, petId: string): PlaydateSave {
  const relationships = { ...save.relationships };
  delete relationships[petId];
  return {
    ...save,
    relationships,
    history: save.history.filter((record) => record.petA.petId !== petId),
    lastPlaydateCompletedAt: null,
  };
}

export function castOf(save: PlaydateSave): PetSnapshot[] {
  return save.cast;
}
