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
  // Split across the trick's linked attributes. trainingGain tapers it near potential.
  learnedPerformanceRaw: 0.25,
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
  // 20261030130000_launch_race_schedule.sql: 5-minute slots, 1-minute rest.
  races: {
    slotMs: 5 * 60 * 1000,
    eventsPerSlot: 3,
    slotsShown: 3,
    capacity: 6,
    gateOpenMs: 60 * 1000,
    // The race call and local notification, later than the gate itself.
    callMs: 30 * 1000,
    lockMs: 10 * 1000,
    cooldownMs: 60 * 1000,
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
  },
  petCam: {
    minAwayHours: 5,
    showChance: 0.15,
    leaveMarginMin: 30,
    returnMarginMin: 15,
    history: 20,
    noRepeatLast: 1,
    openFloor: 160,
    seniorSpeed: 0.72,
    youngWobble: 1.6,
    // Room-frame limits: walkers stay this far from the side walls, and exits go this far past them.
    edgeMargin: 56,
    offscreen: 130,
    // How far the bowl or bed is shoved across the floor.
    pushReach: 220,
    // y sorts the pet just in front of the sofa or bed; z lifts it onto the seat cushion.
    napSpots: {
      livingroom: { x: 510, y: 206, z: 34 },
      bedroom: { x: 350, y: 208, z: 44 },
    },
    filter: {
      dayContrast: 1.35,
      nightGain: 1.15,
      nightLift: 0.06,
      grain: 10,
      nightGrain: 17,
      scanline: 0.06,
      nightScanline: 0.1,
      vignette: 0.6,
      shakePt: 9,
      shakeS: 0.6,
      flash: 0.5,
      flashS: 0.45,
      // Boop: the pet walks up to the lens and grows; the room does not zoom.
      boopScale: 3.2,
      boopPeak: 3.7,
      boopHold: 2.6,
      boopFloorPad: 6,
      bumps: 3,
    },
    clips: {
      boop: { weight: 0.35, duration: 8 },
      sweater: { weight: 1, duration: 8.5 },
      tail: { weight: 1, duration: 8 },
      inOut: { weight: 1, duration: 9.5, passesMin: 3, passesMax: 5, emptyMin: 0.6, emptyMax: 1 },
      hind: { weight: 1, duration: 8, puppyDrop: 4 },
      nap: { weight: 1, duration: 8.5 },
      bowl: { weight: 1, duration: 9 },
      bedPush: { weight: 1, duration: 9.5 },
    },
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
  // Per-slot chance is out of 100. Weather can raise jackets and boots, but not to a guarantee.
  dailyOutfit: {
    slotChance: 50,
    weatherBonus: 15,
    maxRetries: 10,
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
