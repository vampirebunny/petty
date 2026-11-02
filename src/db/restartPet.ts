import type { PetState } from '../sim/types';
import { getDb } from './database';

const markerKey = 'restart_pending';

export type RestartMarker = {
  oldPetId: string;
  startedAt: number;
};

export function readRestartMarker(): RestartMarker | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', markerKey);
  if (!row) {
    return null;
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<RestartMarker>;
    if (typeof parsed.oldPetId !== 'string' || typeof parsed.startedAt !== 'number') {
      return null;
    }
    return { oldPetId: parsed.oldPetId, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

export function writeRestartMarker(marker: RestartMarker): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', markerKey, JSON.stringify(marker));
}

export function clearRestartMarker(): void {
  getDb().runSync('DELETE FROM meta WHERE key = ?', markerKey);
}

export function restartInProgress(): boolean {
  return readRestartMarker() != null;
}

export function archiveRestartedPet(pet: PetState): void {
  getDb().runSync(
    'INSERT OR REPLACE INTO restarted_pets (id, json, restarted_at) VALUES (?, ?, ?)',
    pet.id,
    JSON.stringify(pet),
    pet.restartedAt ?? Date.now(),
  );
}

export function readRestartedPet(id: string): PetState | null {
  const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM restarted_pets WHERE id = ?', id);
  if (!row) {
    return null;
  }
  try {
    return JSON.parse(row.json) as PetState;
  } catch {
    return null;
  }
}
