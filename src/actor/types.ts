import type { Equipped } from '../sim/types';
import type { Scene } from './scenes';

export type Vec = { x: number; y: number };

export type Species = 'dog' | 'cat';

export type EarShape = 'floppy' | 'pointy' | 'cat';

export type TailShape = 'straight' | 'curl' | 'stub' | 'long' | 'fluffy';

export type Pattern = 'stripes' | 'points' | 'none';

export type TaskType =
  | 'stand'
  | 'sit'
  | 'sleep'
  | 'eat'
  | 'walk'
  | 'jump'
  | 'pant'
  | 'paw'
  | 'bark'
  | 'idle'
  | 'fetch'
  | 'winddown'
  | 'purr'
  | 'groom'
  | 'pounce';

export type Breed = {
  id: string;
  name: string;
  species: Species;
  bodyLen: number;
  bodyH: number;
  legLen: number;
  head: number;
  snout: number;
  earSize: number;
  ear: EarShape;
  tail: TailShape;
  coat: string;
  earColor: string;
  muzzle: string;
  pitch: number;
  size: number;
  cuteness: number;
  eyeColor?: string;
  pattern?: Pattern;
  accent?: string;
  behaviors: readonly TaskType[];
};

export type Pose = {
  sit: number;
  lie: number;
  walk: number;
  paw: number;
  pant: number;
  headDown: number;
  headRest: number;
  eyes: number;
  wagAmp: number;
  breathAmp: number;
  breathRate: number;
  squint: number;
  spineArch: number;
  crouch: number;
};

export type IdleMode = 'still' | 'pant' | 'purr' | 'nap' | 'walk';

export type Task = {
  type: TaskType;
  stage: string;
  t: number;
  kind?: 'eat' | 'drink';
  bats: number;
  cool: number;
};

export type Idle = {
  mode: IdleMode;
  t: number;
  dur: number;
  target: Vec | null;
  sit: boolean;
  arrived: boolean;
};

export type Bark = {
  active: boolean;
  t: number;
  fired: [boolean, boolean];
  open: number;
};

export type Actor = {
  id: string;
  breedId: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  speed: number;
  face: number;
  pose: Pose;
  task: Task;
  idle: Idle;
  phase: number;
  panPh: number;
  chewPh: number;
  wagPh: number;
  breathPh: number;
  blinkT: number;
  pantT: number;
  bark: Bark;
  ageDays: number;
  displayAgeDays: number;
  weight: number;
  displayWeight: number;
  syncedWeight: number;
  vitality: number;
  equipped: Equipped;
  asleep: boolean;
  mouth: Vec;
  anchors: Anchors;
};

export type Anchors = {
  head: { x: number; y: number; pitch: number; radius: number };
  neck: { x: number; y: number };
  torso: { theta: number; dy: number; pivot: { x: number; y: number } };
  paws: { x: number; y: number; shin: number }[];
  scale: number;
  facing: 1 | -1;
};

export type Ball = {
  state: 'none' | 'free' | 'carried';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  carrierId: string | null;
};

export type World = {
  actors: Actor[];
  ball: Ball;
  bowlFill: number;
  t: number;
  rng: () => number;
  scene: Scene;
  reducedMotion: boolean;
};

export type ActorSource = {
  id: string;
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  equipped: Equipped;
  asleep: boolean;
};
