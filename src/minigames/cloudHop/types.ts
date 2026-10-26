import type { CollectKind } from './content';

export type Rng = () => number;

export type CloudType = 'normal' | 'bouncy' | 'rain' | 'elevator' | 'thunder';

export type Cloud = {
  id: number;
  type: CloudType;
  x: number;
  y: number;
  baseY: number;
  prevY: number;
  w: number;
  vx: number;
  alpha: number;
  timer: number;
  sq: number;
  amp: number;
  ph: number;
  es: number;
  th: number;
  announce: boolean;
  warn?: boolean;
  zap?: boolean;
  gone?: boolean;
};

export type ItemKind = 'coin' | CollectKind | 'umbrella' | 'balloon' | 'magnet';

export type Item = {
  k: ItemKind;
  x: number;
  y: number;
  ph: number;
  got?: boolean;
};

export type BirdKind = 'bird' | 'crow' | 'diver' | 'flock';

export type Bird = {
  kind: BirdKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  announce: boolean;
  off: number;
  gap: number;
  st: 'patrol' | 'warn' | 'dive';
  tm: number;
  dx: number;
  dy: number;
  flee?: boolean;
  close?: boolean;
  nm?: boolean;
  gone?: boolean;
};

export type Wind = {
  y0: number;
  y1: number;
  dir: number;
  announce: boolean;
  seed: number;
};

export type Floater = {
  x: number;
  y: number;
  txt: string;
  life: number;
  col: string;
  size: number;
};

export type HopSound = 'jump' | 'big' | 'squeak';

export type Banner = { eye: string; title: string; sub: string };

export type RunStats = {
  collect: number;
  tokens: number;
  maxCombo: number;
  perfect: number;
  bouncy: number;
  near: number;
};

export type PetBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  on: Cloud | null;
  rel: number;
  face: 1 | -1;
  sq: number;
  dead: boolean;
  sink: boolean;
  rot: number;
  inv: number;
  balloon: number;
  magnet: number;
  umbrella: boolean;
  umbAnim: number;
  noCut: boolean;
  cut: boolean;
  lastCloud: Cloud | null;
};

export type Phase = 'menu' | 'play' | 'paused' | 'over';

export type Run = {
  W: number;
  H: number;
  seed: number;
  rng: Rng;
  phase: Phase;
  t: number;
  time: number;
  pet: PetBody;
  clouds: Cloud[];
  items: Item[];
  birds: Bird[];
  winds: Wind[];
  fx: Floater[];
  sounds: HopSound[];
  camY: number;
  startY: number;
  topY: number;
  topCloud: Cloud;
  bestY: number;
  pts: number;
  cloudCount: number;
  nextId: number;
  introduced: Set<string>;
  seen: Set<string>;
  freshSeen: string[];
  zoneIdx: number;
  fogY: number;
  fogOn: boolean;
  combo: number;
  stand: number;
  stats: RunStats;
  slowT: number;
  jumpBuf: number;
  deathCause: string;
  overId: number;
  held: boolean;
  ptrX: number;
  invincible: boolean;
  unlockAll: boolean;
  hitboxes: boolean;
  banner: Banner | null;
  bannerT: number;
  bannerCool: number;
  bannerQ: Banner[];
  stars: { x: number; y: number; r: number; p: number }[];
  far: { x: number; y: number; w: number }[];
};
