import type { ParkFindRarity } from './parkFindsConfig';

export type TutorialAction =
  | 'feed'
  | 'water'
  | 'school'
  | 'play'
  | 'nap'
  | 'parkFind'
  | 'pat'
  | 'closet'
  | 'sit'
  | 'cuddle';

export type TutorialGoal = {
  action: TutorialAction;
  label: string;
};

export type XpBand = {
  from: number;
  to: number;
  start: number;
  end: number;
};

// Defaults from the gameplay brief. Level 11 is the first level that costs XP.
// Each tutorial action raises the level by one, in any order. There are more
// actions than the steps from level 1 to level 10.
export const gameplayConfig = {
  maxLevel: 100,
  tutorialLevel: 10,
  everyday: { xp: 2, dailyCap: 100 },
  trickXp: { basic: 50, advanced: 200 } as const,
  findXp: { common: 10, uncommon: 25, rare: 75, legendary: 150 } as Record<ParkFindRarity, number>,
  bands: [
    { from: 11, to: 25, start: 120, end: 250 },
    { from: 26, to: 40, start: 250, end: 300 },
    { from: 41, to: 60, start: 300, end: 1000 },
    { from: 61, to: 100, start: 1000, end: 4000 },
  ] as const satisfies readonly XpBand[],
  goals: [
    { action: 'feed', label: 'Feed' },
    { action: 'water', label: 'Fill the water bowl' },
    { action: 'school', label: 'Visit the Training School' },
    { action: 'play', label: 'Play ball' },
    { action: 'nap', label: 'Nap in the bed' },
    { action: 'parkFind', label: 'Make a park find' },
    { action: 'pat', label: 'Pat' },
    { action: 'cuddle', label: 'Cuddle' },
    { action: 'closet', label: 'Put on something from the Closet' },
    { action: 'sit', label: 'Learn Sit' },
  ] as const satisfies readonly TutorialGoal[],
};
