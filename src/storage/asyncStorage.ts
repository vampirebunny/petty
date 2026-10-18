import AsyncStorage from '@react-native-async-storage/async-storage';

import { withDerived } from '../sim/attributes';
import { clampWeight } from '../sim/care';
import { archetypes, dayMs, defaultSceneId, traits } from '../sim/config';
import type { Equipped, Look, PetAttributes, PetState, Stats } from '../sim/types';
import type { PetStorage } from './PetStorage';

const storageKey = 'petty.pet';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function readStats(value: unknown): Stats | null {
  if (!isRecord(value)) {
    return null;
  }
  const stats = {} as Stats;
  for (const trait of traits) {
    const score = value[trait];
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return null;
    }
    stats[trait] = score;
  }
  return stats;
}

function readAttributes(value: unknown): PetAttributes | null {
  if (!isRecord(value)) {
    return null;
  }
  const potential = readStats(value.potential);
  const current = readStats(value.current);
  if (
    typeof value.seed !== 'number' ||
    typeof value.rulesVersion !== 'number' ||
    !archetypes.includes(value.archetype as never) ||
    !potential ||
    !current
  ) {
    return null;
  }
  return {
    seed: value.seed,
    rulesVersion: value.rulesVersion,
    archetype: value.archetype as PetAttributes['archetype'],
    potential,
    current,
  };
}

function readLook(value: unknown): Look | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.coat !== 'string' || typeof value.ear !== 'string' || typeof value.tail !== 'string') {
    return null;
  }
  return { coat: value.coat, ear: value.ear, tail: value.tail };
}

// A pet saved in an older shape (litter variants, temperament, no look) does not load, and
// adoption starts over. That is the same rule as any save that does not match the current shape.
function migratePet(value: unknown): PetState | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value;
  const needs = raw.needs;
  const attributes = readAttributes(raw.attributes);
  const look = readLook(raw.look);
  const drift = readStats(raw.drift);
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
    !attributes ||
    !look ||
    !drift ||
    !isRecord(needs) ||
    typeof needs.fullness !== 'number' ||
    typeof needs.energy !== 'number' ||
    typeof needs.happiness !== 'number' ||
    !Array.isArray(raw.careWindow)
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
    attributes,
    look,
    drift,
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

  async clear() {
    await AsyncStorage.removeItem(storageKey);
  },
};
