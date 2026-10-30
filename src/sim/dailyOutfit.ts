import { mulberry, seedOf } from '../actor/mulberry';
import { outfitSlots, wearItem } from '../actor/wardrobe';
import { catalogItem } from '../economy/catalog';
import { gameplayConfig } from './gameplayConfig';
import type { Equipped, OutfitSlot, PetState } from './types';

export type OwnedWear = { slot: OutfitSlot; id: string };

export type DailyOutfitInput = {
  owned: readonly OwnedWear[];
  species: 'dog' | 'cat';
  previous: Equipped;
  /** Rain, snow, or winter at the moment of the pick. Raises jacket and boot odds. */
  tilt: boolean;
  seed: number;
  day: string;
};

export function sameOutfit(a: Equipped, b: Equipped): boolean {
  return outfitSlots.every((slot) => (a[slot] ?? undefined) === (b[slot] ?? undefined));
}

export function dailyOutfitDue(pet: PetState, today: string): boolean {
  if (!pet.dailyOutfitEnabled || pet.retiredAt) {
    return false;
  }
  return today > (pet.lastOutfitPickDate ?? '');
}

/** Toggle on. Today is already picked, and tomorrow avoids whatever they have on now. */
export function armDailyOutfit(pet: PetState, today: string): PetState {
  return {
    ...pet,
    dailyOutfitEnabled: true,
    lastOutfitPickDate: today,
    previousOutfit: { ...pet.equipped },
  };
}

export function clearDailyOutfit(pet: PetState): PetState {
  return { ...pet, dailyOutfitEnabled: false };
}

/** A closet edit holds the rest of the day and becomes the outfit tomorrow should not copy. */
export function noteManualOutfit(pet: PetState, today: string): PetState {
  if (!pet.dailyOutfitEnabled) {
    return pet;
  }
  return {
    ...pet,
    lastOutfitPickDate: today,
    previousOutfit: { ...pet.equipped },
  };
}

/** Store Dressed Up without paying it, so a later publish does not toast or burst. */
export function silenceDressedUp(pet: PetState): PetState {
  const wearing = Object.values(pet.equipped).some((id) => Boolean(id));
  if (!wearing || (pet.badges ?? []).includes('dressed-up')) {
    return pet;
  }
  return {
    ...pet,
    badges: [...(pet.badges ?? []), 'dressed-up'],
    badgeXpSkipped: [...(pet.badgeXpSkipped ?? []), 'dressed-up'],
  };
}

export function applyDailyPick(pet: PetState, outfit: Equipped, today: string): PetState {
  return silenceDressedUp({
    ...pet,
    equipped: outfit,
    lastOutfitPickDate: today,
    previousOutfit: { ...outfit },
  });
}

function chanceFor(slot: OutfitSlot, tilt: boolean): number {
  const { slotChance, weatherBonus } = gameplayConfig.dailyOutfit;
  const bonus = tilt && (slot === 'jacket' || slot === 'boots') ? weatherBonus : 0;
  return Math.min(99, slotChance + bonus);
}

function eligibleGroups(owned: readonly OwnedWear[], species: 'dog' | 'cat'): Map<OutfitSlot, string[]> {
  const groups = new Map<OutfitSlot, string[]>();
  const seen = new Set<string>();
  for (const item of owned) {
    const key = `${item.slot}:${item.id}`;
    if (seen.has(key) || !wearItem(item.slot, item.id)) {
      continue;
    }
    const row = catalogItem(key);
    if (row?.species && !row.species.includes(species)) {
      continue;
    }
    seen.add(key);
    const list = groups.get(item.slot) ?? [];
    list.push(item.id);
    groups.set(item.slot, list);
  }
  return groups;
}

function rollOnce(rng: () => number, groups: Map<OutfitSlot, string[]>, tilt: boolean): Equipped {
  const next: Equipped = {};
  for (const slot of outfitSlots) {
    const items = groups.get(slot);
    if (!items || items.length === 0) {
      continue;
    }
    if (rng() * 100 >= chanceFor(slot, tilt)) {
      continue;
    }
    const pick = items[Math.floor(rng() * items.length)];
    if (pick) {
      next[slot] = pick;
    }
  }
  if (Object.values(next).some((id) => Boolean(id))) {
    return next;
  }
  const flat = outfitSlots.flatMap((slot) => (groups.get(slot) ?? []).map((id) => ({ slot, id })));
  const pick = flat[Math.floor(rng() * flat.length)];
  if (pick) {
    next[pick.slot] = pick.id;
  }
  return next;
}

/** Null when nothing the pet owns can be worn. */
export function pickDailyOutfit(input: DailyOutfitInput): Equipped | null {
  const groups = eligibleGroups(input.owned, input.species);
  if (groups.size === 0) {
    return null;
  }
  const tries = Math.max(1, gameplayConfig.dailyOutfit.maxRetries);
  let last: Equipped = {};
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const rng = mulberry(seedOf(`${input.seed}:${input.day}:${attempt}`));
    last = rollOnce(rng, groups, input.tilt);
    if (!sameOutfit(last, input.previous)) {
      return last;
    }
  }
  return last;
}
