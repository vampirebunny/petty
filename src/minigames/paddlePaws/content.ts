// Tuning for Paddle Paws. Distances are meters. Speeds and sizes are logical units.

export const WORLD_W = 400;
export const PET_X = 118;
export const HIT_R = 14;
export const GATE_W = 66;
export const TOP = 62;
export const BED = 46;
export const PX_PER_M = 40;
export const DEAD_BAND = 8;

export const SWIM_V = 330;
export const SINK_V = 34;
export const SWIM_EASE = 7;
export const SINK_EASE = 3;
export const TILT_EASE = 10;
export const PADDLE_SWIM = 15;
export const PADDLE_DRIFT = 8;

export const SCROLL_BASE = 165;
export const SCROLL_RAMP = 0.45;
export const SCROLL_CAP = 300;

export const FIRST_GATE_X = 540;
export const SPAWN_WHEN = 440;
export const GAP_MIN = 170;
export const GAP_START = 252;
export const GAP_RAMP = 0.28;
export const SWING_BASE = 130;
export const SWING_RAMP = 0.35;
export const SWING_CAP = 230;
export const MOVE_AMP = 55;
export const MOVE_CHANCE = 0.4;

export const UNLOCK = {
  pearl: 30,
  jelly: 40,
  shield: 60,
  puffer: 110,
  moving: 190,
  glow: 330,
  raysGone: 450,
} as const;

export const POINTS = {
  shell: 1,
  pearl: 5,
  gem: 10,
  chest: 25,
} as const;

export type ItemKind = keyof typeof POINTS | 'shield';

export const POPUP: Record<Exclude<ItemKind, 'shield'>, { color: string; size: number }> = {
  shell: { color: '#e2569b', size: 16 },
  pearl: { color: '#7a5fc0', size: 20 },
  gem: { color: '#1f8fb8', size: 23 },
  chest: { color: '#c98a12', size: 30 },
};

export const CAUSE: Record<string, string> = {
  rock: 'Bonked a rock',
  coral: 'Bumped into the coral',
  jelly: 'A jellyfish zapped your pet',
  puffer: 'A pufferfish puffed up on your pet',
  quit: 'You ended the run',
};

export const ZONES: { from: number; name: string; top: string; bottom: string }[] = [
  { from: 0, name: 'Sunny Shallows', top: '#a6ecf2', bottom: '#4fb8d8' },
  { from: 120, name: 'Coral Garden', top: '#86d6ee', bottom: '#3a92c8' },
  { from: 260, name: 'Kelp Forest', top: '#63b4dc', bottom: '#2f70ae' },
  { from: 420, name: 'Twilight Reef', top: '#4a7ec0', bottom: '#2a3f86' },
  { from: 600, name: 'Glow Deep', top: '#2f4a8a', bottom: '#1b2258' },
];

export const HOW_TO = 'Paddle through the reef, grab treasures for points and dodge the rocks, coral and sea critters. One bump and it\'s over.';
