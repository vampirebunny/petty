import { formatFriendNames } from './party';
import { maxPlaydateRecordVersion, type PlaydateRecord } from './types';

export function newPlaydateId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const roll = Math.floor(Math.random() * 16);
    const value = char === 'x' ? roll : (roll & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function playdateTooNew(record: PlaydateRecord): boolean {
  return record.version > maxPlaydateRecordVersion;
}

export function recordForServer(record: PlaydateRecord): PlaydateRecord {
  const copy: PlaydateRecord = { ...record };
  delete copy.syncStatus;
  delete copy.incoming;
  delete copy.unwatched;
  return copy;
}

// The viewer's pet is named first. Other pets follow, and a deleted initiator is Former player.
export function incomingPlaydateLabel(record: PlaydateRecord, viewerId: string, ownPetName: string): string {
  const mineId = `friend:${viewerId}`;
  const pets = [record.petA];
  const rest = record.party && record.party.length > 0 ? record.party : [record.petB];
  for (const pet of rest) {
    if (!pets.some((item) => item.snapshotId === pet.snapshotId)) {
      pets.push(pet);
    }
  }
  const mine = pets.find((pet) => pet.snapshotId === mineId);
  const mineName = mine?.name ?? ownPetName;
  const others = pets.filter((pet) => pet.snapshotId !== mine?.snapshotId).map((pet) => pet.name);
  const former = record.initiatorFormer || record.petA.anonymized ? ' · Former player' : '';
  return `${mineName} had a playdate with ${formatFriendNames(others)}${former}`;
}
