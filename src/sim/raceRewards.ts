import { localDay } from '../economy/clock';
import { gameplayConfig } from './gameplayConfig';
import { grantXp, noteTutorialAction } from './progress';
import { syncBadges } from './badges';
import { completeSuggestion } from './suggestions';
import type { PetState } from './types';

export type Ribbon = {
  raceId: string;
  event: string;
  classId: string;
  place: number;
  at: number;
};

export type RaceFinish = {
  raceId: string;
  event: string;
  classId: string;
  place: number;
  at: number;
};

function xpForPlace(place: number): number {
  const xp = gameplayConfig.races.xp;
  if (place === 1) return xp.first;
  if (place === 2) return xp.second;
  if (place === 3) return xp.third;
  return xp.entered;
}

export function ribbonCount(state: PetState): number {
  return (state.ribbons ?? []).filter((row) => row.place >= 1 && row.place <= 3).length;
}

export function applyRaceRewards(state: PetState, finish: RaceFinish, now: number): PetState {
  const applied = state.appliedRaceIds ?? [];
  if (!finish.raceId || applied.includes(finish.raceId) || finish.place < 1) {
    return state;
  }
  const day = localDay(now);
  const count = state.raceXpDay === day ? (state.raceXpCount ?? 0) : 0;
  const pay = state.level >= gameplayConfig.tutorialLevel && count < gameplayConfig.races.dailyXpRaces;
  let next: PetState = {
    ...state,
    needs: {
      ...state.needs,
      energy: Math.max(0, state.needs.energy - gameplayConfig.races.energyCost),
    },
    ribbons: [...(state.ribbons ?? []), finish],
    appliedRaceIds: [...applied, finish.raceId],
    raceXpDay: day,
    raceXpCount: pay ? count + 1 : count,
    // The ticket is for the race that just ended. Keeping it made the next board
    // look like the pet was still signed up.
    races: { signup: null, entered: true },
  };
  if (pay) {
    next = grantXp(next, xpForPlace(finish.place));
  }
  next = noteTutorialAction(next, 'race');
  next = completeSuggestion(next, 'race', now);
  return syncBadges(next, now);
}
