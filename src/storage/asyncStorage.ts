import AsyncStorage from '@react-native-async-storage/async-storage';

import { withDerived } from '../sim/attributes';
import { ensureGame } from '../sim/game';
import { clampWeight } from '../sim/care';
import {
  agingCalendar,
  archetypes,
  dayMs,
  defaultSceneId,
  scaleLegacyAgeDays,
  startingHydration,
  startingToys,
  startingWaterLevel,
  traits,
} from '../sim/config';
import type {
  ActiveBoost,
  Look,
  Needs,
  PetAttributes,
  PetState,
  Stats,
  TreatDay,
  TreatStack,
} from '../sim/types';
import type { PetStorage } from './PetStorage';
import { migrateEquipped } from '../actor/closet';
import { migrateBreedId } from './migrateIds';

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
  if (typeof value.coat !== 'string') {
    return null;
  }
  // Older saves also stored ear and tail choices. Both now come from breed data, so they are dropped here and
  // the pet snaps to its breed's own ears and tail on the next save.
  const look: Look = { coat: value.coat };
  if (value.pattern === 'stripes' || value.pattern === 'points' || value.pattern === 'bicolor' || value.pattern === 'none') {
    look.pattern = value.pattern;
  }
  if (typeof value.eyeColor === 'string') {
    look.eyeColor = value.eyeColor;
  }
  if (typeof value.accent === 'string') {
    look.accent = value.accent;
  }
  return look;
}

function readNeeds(value: unknown): Needs | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.energy !== 'number' || typeof value.happiness !== 'number') {
    return null;
  }
  if (typeof value.hunger === 'number') {
    return { hunger: value.hunger, energy: value.energy, happiness: value.happiness };
  }
  if (typeof value.fullness === 'number') {
    return { hunger: 100 - value.fullness, energy: value.energy, happiness: value.happiness };
  }
  return null;
}

function readTreats(value: unknown): TreatStack[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const stacks: TreatStack[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.treatId !== 'string' || typeof entry.count !== 'number') {
      continue;
    }
    stacks.push({ treatId: entry.treatId, count: entry.count });
  }
  return stacks;
}

function readTreatDay(value: unknown): TreatDay {
  if (!isRecord(value) || typeof value.day !== 'number' || typeof value.count !== 'number') {
    return { day: 0, count: 0 };
  }
  return { day: value.day, count: value.count };
}

function readBoosts(value: unknown): ActiveBoost[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const boosts: ActiveBoost[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.attribute !== 'string' ||
      typeof entry.multiplier !== 'number' ||
      typeof entry.startAt !== 'number' ||
      typeof entry.endAt !== 'number'
    ) {
      continue;
    }
    boosts.push({
      attribute: entry.attribute,
      multiplier: entry.multiplier,
      startAt: entry.startAt,
      endAt: entry.endAt,
    });
  }
  return boosts;
}

function readToys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...startingToys];
  }
  const toys = value.filter((entry): entry is string => typeof entry === 'string');
  return toys.length > 0 ? toys : [...startingToys];
}

// A pet saved in an older shape (litter variants, temperament, no look) does not load, and
// adoption starts over. That is the same rule as any save that does not match the current shape.
function migratePet(value: unknown): PetState | null {
  if (!isRecord(value)) {
    return null;
  }
  const raw = value;
  const needs = readNeeds(raw.needs);
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
    !needs ||
    !Array.isArray(raw.careWindow)
  ) {
    return null;
  }

  const legacy = typeof raw.weightAppliedAt !== 'number';
  const storedWeight = raw.weight;
  const weight = storedWeight < -1 || storedWeight > 1 ? (storedWeight - 50) / 50 : storedWeight;
  const storedBornAt = legacy
    ? raw.lastUpdatedAt - raw.ageDays * dayMs
    : typeof raw.bornAt === 'number'
      ? raw.bornAt
      : raw.lastUpdatedAt - raw.ageDays * dayMs;
  const onMonthCalendar = raw.agingCalendar === agingCalendar;
  const ageDays = onMonthCalendar ? raw.ageDays : scaleLegacyAgeDays(raw.ageDays);
  const bornAt = onMonthCalendar ? storedBornAt : raw.lastUpdatedAt - ageDays * dayMs;
  const equipped = migrateEquipped(isRecord(raw.equipped) ? raw.equipped : {});
  const waterLevel =
    typeof raw.waterLevel === 'number' && Number.isFinite(raw.waterLevel)
      ? Math.max(0, Math.min(1, raw.waterLevel))
      : startingWaterLevel;
  const waterEmptySince =
    raw.waterEmptySince === null || typeof raw.waterEmptySince === 'number' ? raw.waterEmptySince : null;
  const savedHydration = raw.hydration;
  const savedThirst = raw.thirst;
  const hydration =
    typeof savedHydration === 'number' && Number.isFinite(savedHydration)
      ? Math.max(0, Math.min(100, savedHydration))
      : typeof savedThirst === 'number' && Number.isFinite(savedThirst)
        ? 100 - Math.max(0, Math.min(100, savedThirst))
        : startingHydration;
  const next: PetState = {
    ...(raw as unknown as PetState),
    breedId: migrateBreedId(raw.breedId),
    ageDays,
    agingCalendar,
    attributes,
    look,
    drift,
    needs,
    weight: clampWeight(weight),
    bornAt,
    weightAppliedAt: legacy ? raw.lastUpdatedAt : (raw.weightAppliedAt as number),
    sceneId: typeof raw.sceneId === 'string' ? raw.sceneId : defaultSceneId,
    equipped,
    foodInBowl: raw.foodInBowl === true,
    waterLevel,
    waterEmptySince,
    hydration,
    toys: readToys(raw.toys),
    treats: readTreats(raw.treats),
    treatDay: readTreatDay(raw.treatDay),
    boosts: readBoosts(raw.boosts),
  };
  if (typeof raw.ownerId === 'string') {
    next.ownerId = raw.ownerId;
  } else {
    delete next.ownerId;
  }
  delete (next as { thirst?: unknown }).thirst;
  delete (next as { feedWindow?: unknown }).feedWindow;
  delete (next as { maturityAppliedAt?: unknown }).maturityAppliedAt;
  return withDerived(ensureGame(next));
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
