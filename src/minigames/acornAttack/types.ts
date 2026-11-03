import type { OfferKind, Species } from './content';

export type Phase = 'menu' | 'play' | 'pause' | 'dying' | 'over';

export type SquirrelKind = 'scout' | 'glider' | 'lobber' | 'hoarder';

export type Pattern = 'snake' | 'v' | 'sweep' | 'line';

export type Squirrel = {
  alive: boolean;
  kind: SquirrelKind;
  pattern: Pattern;
  phase: 'move' | 'dazed';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  r: number;
  rot: number;
  flash: number;
  age: number;
  i: number;
  n: number;
  cx: number;
  dir: number;
  hoverY: number;
  locked: boolean;
  throwAt: number;
  squadId: number;
  d: number;
  spin: number;
};

export type Obstacle = {
  alive: boolean;
  kind: 'rock' | 'stump' | 'log';
  x: number;
  y: number;
  r: number;
  half: number;
  seed: number;
};

export type Laser = {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
};

export type Acorn = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
};

export type Pickup = {
  alive: boolean;
  kind: 'treat' | OfferKind;
  shape: 'bone' | 'fish';
  x: number;
  y: number;
  vx: number;
  vy: number;
  choice: boolean;
  fade: number;
  t: number;
};

export type Popup = {
  alive: boolean;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

export type Fx = {
  alive: boolean;
  kind: 'spark' | 'puff' | 'ring';
  x: number;
  y: number;
  life: number;
  max: number;
};

export type Squad = {
  alive: boolean;
  id: number;
  left: number;
  escaped: boolean;
};

export type SoundName = 'laser' | 'impact' | 'explode' | 'powerUp' | 'bloop' | 'badge' | 'hurt';

export type Run = {
  phase: Phase;
  pausedFrom: 'play' | 'dying';
  H: number;
  t: number;
  time: number;
  seed: number;
  rng: () => number;
  traveled: number;
  awardedMeters: number;
  score: number;
  level: number;
  groundSpeed: number;
  groundTarget: number;
  scroll: number;
  laserLevel: number;
  laserTimer: number;
  cool: number;
  hearts: number;
  invuln: number;
  shield: boolean;
  magnet: number;
  petX: number;
  petY: number;
  petVx: number;
  lean: number;
  pendingDx: number;
  pendingDy: number;
  pointing: boolean;
  pointerX: number;
  pointerY: number;
  shake: number;
  scorePop: number;
  levelPop: number;
  edge: number;
  dieT: number;
  species: Species;
  runId: string;
  booped: number;
  treats: number;
  sounds: SoundName[];
  nextSquad: number;
  squadTimer: number;
  gliderTimer: number;
  lobberTimer: number;
  hoarderTimer: number;
  obstacleTimer: number;
  gliderOn: boolean;
  lobberOn: boolean;
  hoarderOn: boolean;
  squirrels: Squirrel[];
  obstacles: Obstacle[];
  lasers: Laser[];
  acorns: Acorn[];
  pickups: Pickup[];
  popups: Popup[];
  fx: Fx[];
  squads: Squad[];
};
