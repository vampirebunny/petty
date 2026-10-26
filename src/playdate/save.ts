import { playdateConfig } from './config';
import { applyPlaydateRewards } from './rewards';
import type { PetSnapshot, PlaydateRecord, PlaydateSave, Relationship } from './types';
import type { PetState } from '../sim/types';

export function emptyPlaydateSave(): PlaydateSave {
  return {
    agingCalendar: 'month',
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
  const partnerIds = record.party && record.party.length > 0 ? record.party.map((pet) => pet.snapshotId) : [record.petB.snapshotId];
  let book: Record<string, Relationship> = { ...save.relationships[petId] };
  for (const partnerId of partnerIds) {
    const current = book[partnerId] ?? {
      bond: 0,
      playdateCount: 0,
      lastPlaydateAt: record.createdAt,
    };
    book = {
      ...book,
      [partnerId]: {
        bond: Math.min(playdateConfig.bondMax, current.bond + record.outcome.bondDelta),
        playdateCount: current.playdateCount + 1,
        lastPlaydateAt: record.createdAt,
      },
    };
  }
  return {
    save: {
      ...save,
      relationships: {
        ...save.relationships,
        [petId]: book,
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

// Twist ids from the records still kept. Version 1 beats have none.
function tagsOf(record: PlaydateRecord): string[] {
  const tags: string[] = [];
  for (const beat of record.beats) {
    if (beat.tag) {
      tags.push(beat.tag);
    }
  }
  return tags;
}

export function recentPlaydateTags(history: readonly PlaydateRecord[]): string[] {
  const tags: string[] = [];
  for (const record of history) {
    if (record.version < 2) {
      continue;
    }
    tags.push(...tagsOf(record));
  }
  return tags;
}

// Tags from the newest record only. Version 1 contributes nothing, so a twist just played can be avoided.
export function latestPlaydateTags(history: readonly PlaydateRecord[]): string[] {
  const record = history[0];
  if (!record || record.version < 2) {
    return [];
  }
  return tagsOf(record);
}
