import { localDay } from '../economy/clock';
import { gameplayConfig } from './gameplayConfig';
import type { TutorialAction } from './gameplayConfig';
import type { ParkFindRarity } from './parkFindsConfig';
import type { PetState } from './types';

export type { TutorialAction };

// XP required to arrive at `level` from the level below. Endpoints of each band are exact.
export function xpCost(level: number): number {
  for (const band of gameplayConfig.bands) {
    if (level < band.from || level > band.to) {
      continue;
    }
    const span = band.to - band.from;
    return band.start + ((band.end - band.start) * (level - band.from)) / span;
  }
  return 0;
}

// Total XP to reach `level` from level 10.
export function xpToReach(level: number): number {
  let sum = 0;
  for (let step = gameplayConfig.tutorialLevel + 1; step <= level; step += 1) {
    sum += xpCost(step);
  }
  return sum;
}

export function parkFindCount(state: PetState): number {
  return (state.parkFinds?.items ?? []).reduce((sum, row) => sum + row.count, 0);
}

function bumpTutorial(state: PetState): PetState {
  const level = state.level + 1;
  return {
    ...state,
    level,
    ...(level === gameplayConfig.tutorialLevel ? { xpTotal: 0, xpIntoLevel: 0 } : {}),
  };
}

// Each tutorial action levels the pet once, in any order. Repeats do not.
export function noteTutorialAction(state: PetState, action: TutorialAction): PetState {
  if (state.level >= gameplayConfig.tutorialLevel) {
    return state;
  }
  const seen = state.tutorialSeen ?? [];
  if (seen.includes(action)) {
    return state;
  }
  return bumpTutorial({ ...state, tutorialSeen: [...seen, action] });
}

// A find already in the collection counts as the park-find action, even below level 6.
function withParkFindSeen(state: PetState): PetState {
  if (parkFindCount(state) <= 0 || (state.tutorialSeen ?? []).includes('parkFind')) {
    return state;
  }
  if (state.level >= gameplayConfig.tutorialLevel) {
    return { ...state, tutorialSeen: [...(state.tutorialSeen ?? []), 'parkFind'] };
  }
  return noteTutorialAction(state, 'parkFind');
}

function addXp(state: PetState, amount: number): PetState {
  if (amount <= 0 || state.level < gameplayConfig.tutorialLevel) {
    return state;
  }
  let level = state.level;
  let into = state.xpIntoLevel + amount;
  let total = state.xpTotal + amount;
  while (level < gameplayConfig.maxLevel) {
    const need = xpCost(level + 1);
    if (need <= 0 || into < need) {
      break;
    }
    into -= need;
    level += 1;
  }
  if (level >= gameplayConfig.maxLevel) {
    into = 0;
  }
  return { ...state, level, xpIntoLevel: into, xpTotal: total };
}

export function grantEverydayXp(state: PetState, now: number): PetState {
  if (state.level < gameplayConfig.tutorialLevel) {
    return state;
  }
  const today = localDay(now);
  let spent = state.xpDailyEveryday ?? 0;
  let day = state.xpDailyDay ?? '';
  if (day !== today) {
    spent = 0;
    day = today;
  }
  const room = gameplayConfig.everyday.dailyCap - spent;
  const pay = Math.max(0, Math.min(gameplayConfig.everyday.xp, room));
  const stamped = { ...state, xpDailyEveryday: spent + pay, xpDailyDay: day };
  if (pay <= 0) {
    return stamped;
  }
  return addXp(stamped, pay);
}

export function grantTrickXp(state: PetState, category: 'basic' | 'advanced'): PetState {
  return addXp(state, gameplayConfig.trickXp[category]);
}

export function grantFindXp(state: PetState, rarity: ParkFindRarity): PetState {
  return addXp(state, gameplayConfig.findXp[rarity]);
}

// Marks a newly recorded find as rewarded. Pays rarity XP only from level 10.
// A park find also counts as one tutorial level, whenever it happens.
export function onParkFindRecorded(
  state: PetState,
  itemId: string,
  isNew: boolean,
  rarity: ParkFindRarity,
  _now: number,
): PetState {
  let next = state;
  if (isNew) {
    const row = next.parkFinds.items.find((item) => item.itemId === itemId);
    if (row && !row.firstFindRewarded) {
      if (next.level >= gameplayConfig.tutorialLevel) {
        next = grantFindXp(next, rarity);
      }
      next = {
        ...next,
        parkFinds: {
          ...next.parkFinds,
          items: next.parkFinds.items.map((item) =>
            item.itemId === itemId ? { ...item, firstFindRewarded: true } : item,
          ),
        },
      };
    }
  }
  return noteTutorialAction(next, 'parkFind');
}

// Old saves stored one `xp` number and derived level from age. Test pets reset.
export function ensureProgress(state: PetState): PetState {
  const raw = state as PetState & { xp?: number };
  const legacy = typeof raw.xpTotal !== 'number';
  const { xp: _legacyXp, ...rest } = raw;
  const base: PetState = legacy
    ? {
        ...rest,
        level: 1,
        xpTotal: 0,
        xpIntoLevel: 0,
        xpDailyEveryday: 0,
        xpDailyDay: '',
        tutorialSeen: [],
        parkFindGoalAt: null,
        lastPaidLevel: 1,
      }
    : {
        ...rest,
        level: rest.level ?? 1,
        xpIntoLevel: rest.xpIntoLevel ?? 0,
        xpDailyEveryday: rest.xpDailyEveryday ?? 0,
        xpDailyDay: rest.xpDailyDay ?? '',
        tutorialSeen: rest.tutorialSeen ?? [],
        parkFindGoalAt: rest.parkFindGoalAt ?? null,
      };
  return withParkFindSeen(base);
}
