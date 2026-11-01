import { localDay } from '../economy/clock';
import { gameplayConfig } from './gameplayConfig';
import { grantXp, noteTutorialAction } from './progress';
import { syncBadges } from './badges';
import { racesOf } from './stadium';
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

/** One race input. Energy stops at 0, and a tap at 0 still counts. */
export function spendRaceTap(state: PetState): PetState {
  if (state.needs.energy <= 0) return state;
  return {
    ...state,
    needs: { ...state.needs, energy: Math.max(0, state.needs.energy - 0.25) },
  };
}

export function applyRaceRewards(state: PetState, finish: RaceFinish, now: number): PetState {
  const applied = state.appliedRaceIds ?? [];
  if (!finish.raceId || applied.includes(finish.raceId) || finish.place < 1) {
    return state;
  }
  const day = localDay(now);
  const count = state.raceXpDay === day ? (state.raceXpCount ?? 0) : 0;
  const pay = state.level >= gameplayConfig.tutorialLevel && count < gameplayConfig.races.dailyXpRaces;
  const record = racesOf(state);
  let next: PetState = {
    ...state,
    ribbons: [...(state.ribbons ?? []), finish],
    appliedRaceIds: [...applied, finish.raceId],
    raceXpDay: day,
    raceXpCount: pay ? count + 1 : count,
    // The ticket is for the race that just ended. Keeping it made the next board
    // look like the pet was still signed up.
    races: {
      signup: record.signups.filter((row) => row.raceId !== finish.raceId)[0] ?? null,
      signups: record.signups.filter((row) => row.raceId !== finish.raceId),
      entered: true,
      friendGame: record.friendGame,
    },
  };
  if (pay) {
    next = grantXp(next, xpForPlace(finish.place));
  }
  next = noteTutorialAction(next, 'race');
  next = completeSuggestion(next, 'race', now);
  return syncBadges(next, now);
}

// Friend games give no XP or ribbon. Energy is spent on each input, not at the finish.
export function applyFriendRaceResult(state: PetState, raceId: string): PetState {
  const applied = state.appliedRaceIds ?? [];
  if (!raceId || applied.includes(raceId)) {
    return state;
  }
  const record = racesOf(state);
  return {
    ...state,
    appliedRaceIds: [...applied, raceId],
    races: {
      signup: record.signup,
      signups: record.signups,
      entered: record.entered,
      friendGame: record.friendGame?.raceId === raceId ? null : record.friendGame,
    },
  };
}

// Sending the invites is what counts for "Start a friends game".
export function noteFriendGameStarted(state: PetState, now: number): PetState {
  const next = noteTutorialAction(state, 'friendGame');
  return completeSuggestion(next, 'friendGame', now);
}
