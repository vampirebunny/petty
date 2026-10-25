import { shownLevel, stageOf, withDerived } from '../sim/attributes';
import { ensureGame } from '../sim/game';
import type { PetState } from '../sim/types';
import { asyncPetStorage } from '../storage/asyncStorage';
import { getDb } from './database';

import AsyncStorage from '@react-native-async-storage/async-storage';

let revision = 0;
let queue: Promise<void> = Promise.resolve();

function revive(json: string): PetState {
  const parsed = JSON.parse(json) as PetState;
  const pet = withDerived(ensureGame(parsed));
  if (pet.lastPaidLevel != null && pet.lastPaidStage != null) {
    return pet;
  }
  return {
    ...pet,
    lastPaidLevel: pet.lastPaidLevel ?? shownLevel(pet.xp, stageOf(pet.ageDays)),
    lastPaidStage: pet.lastPaidStage ?? stageOf(pet.ageDays),
  };
}

function writePet(pet: PetState): void {
  const database = getDb();
  database.runSync('DELETE FROM pet');
  database.runSync('INSERT INTO pet (id, json, updated_at) VALUES (?, ?, ?)', pet.id, JSON.stringify(pet), Date.now());
}

// Startup loads the pet twice when a session is restored: bootstrap awaits bind, which notifies
// install state, and the screen load continues after that. Both pass the marker check before
// either insert, so the second write hits the meta primary key.
let legacyImport: Promise<PetState | null> | null = null;

async function importLegacyOnce(): Promise<PetState | null> {
  const database = getDb();
  const marked = database.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'pet_imported'");
  if (marked) {
    return null;
  }
  const legacy = await asyncPetStorage.load();
  const inserted = database.runSync("INSERT OR IGNORE INTO meta (key, value) VALUES ('pet_imported', '1')");
  if (inserted.changes === 0) {
    const row = database.getFirstSync<{ json: string }>('SELECT json FROM pet LIMIT 1');
    return row ? revive(row.json) : null;
  }
  if (!legacy) {
    return null;
  }
  const pet = revive(JSON.stringify(legacy));
  writePet(pet);
  if (pet.ownerId) {
    const raw = await AsyncStorage.getItem(`petty.wardrobe.${pet.ownerId}`);
    if (raw) {
      database.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_closet', ?)", raw);
    }
  }
  return pet;
}

function importLegacy(): Promise<PetState | null> {
  if (!legacyImport) {
    legacyImport = importLegacyOnce().finally(() => {
      legacyImport = null;
    });
  }
  return legacyImport;
}

export const sqlitePetStorage = {
  async load(): Promise<PetState | null> {
    const database = getDb();
    const row = database.getFirstSync<{ json: string }>('SELECT json FROM pet LIMIT 1');
    if (row) {
      return revive(row.json);
    }
    return importLegacy();
  },
  async save(pet: PetState): Promise<void> {
    const rev = ++revision;
    queue = queue.then(() => {
      if (rev !== revision) {
        return;
      }
      writePet(pet);
    });
    await queue;
  },
  async clear(): Promise<void> {
    revision += 1;
    getDb().runSync('DELETE FROM pet');
  },
};

export function writePetNow(pet: PetState): void {
  revision += 1;
  writePet(pet);
}

export function readLegacyCloset(): string | null {
  const row = getDb().getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'legacy_closet'");
  return row?.value ?? null;
}
