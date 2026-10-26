import type { ItemKind } from './content';

export type Rng = () => number;

export type Phase = 'ready' | 'play' | 'paused' | 'dying' | 'over';

export type HitKind = 'rock' | 'coral' | 'jelly' | 'puffer';

export type PaddleSound = 'start' | 'up' | 'shell' | 'pearl' | 'gem' | 'chest' | 'power' | 'pop' | 'bonk' | 'zap' | 'record';

export type Gate = {
  x: number;
  c: number;
  gap: number;
  amp: number;
  ph: number;
  seed: number;
};

export type Hazard = {
  k: 'jelly' | 'puffer';
  x: number;
  y: number;
  y0: number;
  amp: number;
  ph: number;
  bob: number;
};

export type Item = {
  k: ItemKind;
  x: number;
  y: number;
  g: Gate | null;
  dy: number;
  ph: number;
  got?: boolean;
};

export type Popup = {
  txt: string;
  x: number;
  y: number;
  col: string;
  size: number;
  life: number;
  vy: number;
};

export type Bubble = {
  x: number;
  y: number;
  r: number;
  vy: number;
  life: number;
  own: number;
};

export type Kelp = {
  x: number;
  h: number;
  ph: number;
};

export type PetBody = {
  x: number;
  y: number;
  vy: number;
  rot: number;
  inv: number;
  shield: boolean;
  ph: number;
  bubT: number;
  spin: number;
};

export type Run = {
  W: number;
  H: number;
  seed: number;
  rng: Rng;
  phase: Phase;
  t: number;
  decoT: number;
  dist: number;
  speed: number;
  pet: PetBody;
  gates: Gate[];
  hazards: Hazard[];
  items: Item[];
  fx: Popup[];
  bubbles: Bubble[];
  kelp: Kelp[];
  sounds: PaddleSound[];
  spawnX: number;
  prevGate: Gate | null;
  gateCount: number;
  lastCenter: number;
  score: number;
  bestMeters: number;
  bestScore: number;
  cause: string;
  dieT: number;
  lastDir: number;
  bump: number;
  overId: number;
  reduced: boolean;
  touches: Map<string, number>;
  touchOrder: string[];
  seenHazards: Set<'jelly' | 'puffer'>;
};
