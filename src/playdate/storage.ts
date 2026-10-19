import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateCast } from './npcs';
import { clearPet, emptyPlaydateSave } from './save';
import { playdateConfig } from './config';
import type { PlaydateSave } from './types';

const listeners = new Set<() => void>();

export function subscribePlaydates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function keyFor(ownerId: string): string {
  return `petty.playdates.${ownerId}`;
}

function isSave(value: unknown): value is PlaydateSave {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const raw = value as PlaydateSave;
  return Array.isArray(raw.cast) && Array.isArray(raw.history) && !!raw.relationships && typeof raw.relationships === 'object';
}

export async function loadPlaydateSave(ownerId: string): Promise<PlaydateSave> {
  const raw = await AsyncStorage.getItem(keyFor(ownerId));
  if (!raw) {
    return emptyPlaydateSave();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSave(parsed) ? parsed : emptyPlaydateSave();
  } catch {
    return emptyPlaydateSave();
  }
}

export async function savePlaydateSave(ownerId: string, save: PlaydateSave): Promise<void> {
  await AsyncStorage.setItem(keyFor(ownerId), JSON.stringify(save));
  emit();
}

export function ensureCast(save: PlaydateSave, ownerId: string): PlaydateSave {
  if (save.cast.length >= playdateConfig.castMin) {
    return save;
  }
  return { ...save, cast: generateCast(ownerId) };
}

export async function clearPetPlaydates(ownerId: string, petId: string): Promise<void> {
  const save = await loadPlaydateSave(ownerId);
  await savePlaydateSave(ownerId, clearPet(save, petId));
}
