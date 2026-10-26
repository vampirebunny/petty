// Tuning for Cloud Hop. Point values, unlocks, and banner copy live here.

export const WORLD_W = 400;
export const GRAVITY = 1900;
export const JUMP_V = 800;
export const PX_PER_M = 20;
export const FOG_START_M = 60;
export const MIN_CLOUD_W = 50;

export const UNLOCK = {
  bouncy: 50,
  crow: 100,
  rain: 150,
  diver: 200,
  elevator: 250,
  wind: 300,
  flock: 350,
  thunder: 400,
} as const;

export type UnlockKey = keyof typeof UNLOCK;

export const INTRO: Record<string, [string, string]> = {
  bouncy: ['Bouncy clouds', 'Land on one to launch extra high'],
  crow: ['Thief crows', 'Bump one and it steals 100 points'],
  rain: ['Rain clouds', 'They melt soon after you land'],
  diver: ['Diving birds', 'They flash, then swoop at you'],
  elevator: ['Elevator clouds', 'They ride up and down'],
  wind: ['Wind', 'Streaks push you sideways in the air'],
  flock: ['Bird flocks', 'Hop through the gap'],
  thunder: ['Thunderclouds', 'Leave when it glows, before the zap'],
};

export const ZONES = [
  'Cotton Candy Meadow',
  'Marshmallow Heights',
  'Bubblegum Breeze',
  'Lavender Drift',
  'Twilight Puffs',
  'Starry Sky',
  'Moonbeam Ridge',
  'Boop Galaxy',
];

export const COLLECT = {
  biscuit: { pts: 15, col: '#b8732f' },
  yarn: { pts: 25, col: '#e2569b' },
  duck: { pts: 40, col: '#d99a00' },
  bell: { pts: 75, col: '#c98a12' },
  star: { pts: 150, col: '#7a5fd0' },
} as const;

export type CollectKind = keyof typeof COLLECT;

export const PTS_PER_M = 10;
export const PTS_COIN = 10;
export const PTS_PERFECT = 25;
export const PTS_NEAR = 50;
export const PTS_EXTRA_UMBRELLA = 50;

export const HOW_TO = 'Tap anywhere to jump. Hold longer to jump higher. Keep your finger left or right of your pet to steer.';
