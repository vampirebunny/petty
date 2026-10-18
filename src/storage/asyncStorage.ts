import AsyncStorage from '@react-native-async-storage/async-storage';

import { withDerived } from '../sim/attributes';
import { clampWeight } from '../sim/care';
import { dayMs, defaultSceneId } from '../sim/config';
import type { Equipped, PetState } from '../sim/types';
import type { PetStorage } from './PetStorage';

const storageKey = 'petty.pet';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function migratePet(value: unknown): PetState | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value;
  const needs = raw.needs;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.breedId !== 'string' ||
    typeof raw.ageDays !== 'number' ||
    typeof raw.vitality !== 'number' ||
    typeof raw.weight !== 'number' ||
    typeof raw.asleep !== 'boolean' ||
    typeof raw.lastUpdatedAt !== 'number' ||
    typeof raw.rngState !== 'number' ||
    typeof raw.seed !== 'number' ||
    (raw.variant !== 0 && raw.variant !== 1 && raw.variant !== 2) ||
    !isRecord(needs) ||
    typeof needs.fullness !== 'number' ||
    typeof needs.energy !== 'number' ||
    typeof needs.happiness !== 'number' ||
    !Array.isArray(raw.careWindow) ||
    !isRecord(raw.potential) ||
    !isRecord(raw.trained) ||
    !isRecord(raw.temperament) ||
    !isRecord(raw.drift)
  ) {
    return null;
  }

  const legacy = typeof raw.weightAppliedAt !== 'number';
  const storedWeight = raw.weight;
  const weight = storedWeight < -1 || storedWeight > 1 ? (storedWeight - 50) / 50 : storedWeight;
  const bornAt = legacy
    ? raw.lastUpdatedAt - raw.ageDays * dayMs
    : typeof raw.bornAt === 'number'
      ? raw.bornAt
      : raw.lastUpdatedAt - raw.ageDays * dayMs;
  const equipped = isRecord(raw.equipped) ? (raw.equipped as Equipped) : {};
  const next = {
    ...(raw as unknown as PetState),
    weight: clampWeight(weight),
    bornAt,
    weightAppliedAt: legacy ? raw.lastUpdatedAt : (raw.weightAppliedAt as number),
    sceneId: typeof raw.sceneId === 'string' ? raw.sceneId : defaultSceneId,
    equipped,
  };
  delete (next as { feedWindow?: unknown }).feedWindow;
  delete (next as { maturityAppliedAt?: unknown }).maturityAppliedAt;
  return withDerived(next);
}

export const asyncPetStorage: PetStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw == null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return migratePet(parsed);
    } catch {
      return null;
    }
  },

  async save(state) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
  },
};
