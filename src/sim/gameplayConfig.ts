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
  | 'cuddle'
  | 'race'
  | 'friendGame';

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
  tutorialXp: 10,
  everyday: { xp: 2, dailyCap: 100 },
  trickXp: { basic: 50, advanced: 200 } as const,
  findXp: { common: 10, uncommon: 25, rare: 75, legendary: 150 } as Record<ParkFindRarity, number>,
  bands: [
    { from: 11, to: 25, start: 120, end: 250 },
    { from: 26, to: 40, start: 250, end: 300 },
    { from: 41, to: 60, start: 300, end: 1000 },
    { from: 61, to: 100, start: 1000, end: 4000 },
  ] as const satisfies readonly XpBand[],
  badges: {
    xp: { once: 50, bronze: 50, silver: 100, gold: 200 },
    streak: [3, 7, 30],
    devoted: [10, 50, 100],
    tricks: [5, 10, 20],
    finds: [10, 25, 50],
    ribbons: [5, 25, 100],
  },
  suggestions: {
    xp: 30,
    dailyCap: 10,
    practiceReps: 5,
    trainingFromLevel: 3,
    findsFromLevel: 6,
    // Hunger at or above this, or energy below it, is when care suggestions fit.
    needAt: 30,
  },
  // Display defaults. The server's stadium_config row decides slots, sign-ups, and the gate.
  // Testing: 1-minute slots and no rest. Restore to 5 min / 6 min when done.
  // Testing: Hurdles is in every slot and does not require Jump the Hurdle.
  // The server half is 20261029390000_test_hurdles_every_slot.sql. Restore both before launch.
  races: {
    slotMs: 60 * 1000,
    eventsPerSlot: 3,
    slotsShown: 3,
    capacity: 6,
    gateOpenMs: 60 * 1000,
    // The race call and local notification, later than the gate itself.
    callMs: 30 * 1000,
    lockMs: 10 * 1000,
    cooldownMs: 0,
    npcFill: 5,
    heartbeatMs: 5000,
    boardRefreshMs: 15000,
    classes: [
      { id: 'beginner', level: 1 },
      { id: 'novice', level: 10 },
      { id: 'open', level: 20 },
      { id: 'expert', level: 35 },
      { id: 'championship', level: 50 },
    ],
    // The race screen opens this early so "Get ready!" gets its full second before 3, 2, 1.
    countdownMs: 5000,
    xp: { entered: 20, third: 40, second: 60, first: 100 },
    dailyXpRaces: 8,
    energyCost: 8,
    waiveHurdleSkill: true,
    // Testing: Obstacle Course without Jump the Hurdle and Through the Tunnel. Restore before launch.
    waiveObstacleSkill: true,
  },
  // Display defaults. The server's stadium_config row decides the delays and the invite cap.
  friendGames: {
    events: ['funRun', 'hurdles', 'obstacle'] as const,
    delaysMin: [2, 5, 15] as const,
    defaultDelayMin: 5,
    maxInvites: 5,
    recentShown: 5,
    heartbeatMs: 3000,
    invitePollMs: 20000,
  },
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
    { action: 'race', label: 'Compete in the Stadium' },
    { action: 'friendGame', label: 'Start a friends game' },
  ] as const satisfies readonly TutorialGoal[],
};
