import type { Item } from '../items/types';
import type { PointerTarget } from '../input/pointer';
import type { BreedRanges, Equipped, Look } from '../sim/types';
import type { Scene } from './scenes';
import type { CuddleParams } from './data/cuddle';
import type { Variant } from './variation';

export type Vec = { x: number; y: number };

export type Species = 'dog' | 'cat';

export type Pattern = 'stripes' | 'points' | 'bicolor' | 'none';

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
  | 'pounce'
  | 'cuddle';

// Silhouette vocabulary. Each breed picks one value per slot, and the renderer draws the matching shape.
export type EarType =
  | 'erectTall'
  | 'bat'
  | 'longDrape'
  | 'button'
  | 'softFlop'
  // Cat ears.
  | 'standard'
  | 'wedgeLarge'
  | 'smallLow'
  | 'tufted'
  | 'folded';

export type SkullShape = 'wedge' | 'long' | 'dome' | 'broad' | 'fox' | 'round' | 'flat' | 'square';

export type TailType =
  | 'sickleBushy'
  | 'fluffyRump'
  | 'plume'
  | 'thinTaper'
  | 'doubleCurl'
  | 'catLong'
  | 'catThin'
  | 'catPlume'
  | 'catBushy';

export type Texture = 'smooth' | 'ruff' | 'feathered' | 'fluffyRump' | 'longCoat' | 'tufts';

export type EyeShape = 'almond' | 'slanted' | 'round' | 'bigRound';

export type Ruff = 'none' | 'neck' | 'chest';

// Named marking shapes. Head shapes are drawn in head space and follow the 3/4 turn; body shapes in torso space.
export type MarkingShape =
  | 'faceMask'
  | 'cap'
  | 'blaze'
  | 'muzzle'
  | 'browDots'
  | 'blackMask'
  | 'wrinkles'
  | 'ears'
  | 'chest'
  | 'belly'
  | 'socks'
  | 'lowerLegs'
  | 'feathering'
  | 'points'
  | 'tailTip'
  | 'legs'
  | 'tail'
  | 'tabbyBack'
  | 'tabbyM'
  | 'cheekBars'
  | 'tailRings';

// How a marking region gets its color: locked to a fixed color, or derived from the user's palette.
export type ColorRule =
  | { mode: 'locked'; color: string }
  | { mode: 'base' }
  | { mode: 'tint'; amount: number }
  | { mode: 'shade'; amount: number }
  // The user's point accent when the look has one, otherwise a shade of the base.
  | { mode: 'points'; amount: number };

export type MarkingRegion = {
  name: string;
  shape: MarkingShape;
  where: 'head' | 'body';
  color: ColorRule;
  // Only active when the look's pattern is this one (tabby stripes only for 'stripes').
  when?: Pattern;
};

export type ResolvedMarking = { name: string; shape: MarkingShape; where: 'head' | 'body'; color: string; locked: boolean };

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
  // Silhouette parameters. They come from breed data only: the look never changes them.
  earType: EarType;
  skull: SkullShape;
  // Brow-to-snout step depth, 0 (flat wedge) to 1 (deep).
  stop: number;
  tailType: TailType;
  texture: Texture;
  noseSize: number;
  muzzleWidth: number;
  eyeShape: EyeShape;
  // 1 is average. Below is close-set, above is wide-set.
  eyeSpacing: number;
  // Eye size multiplier on top of the eye shape. Omitted is 1.
  eyeSize?: number;
  markings: readonly MarkingRegion[];
  // How the body color is derived from the user's color. Default is the user's color itself.
  baseRule?: ColorRule;
  ruff: Ruff;
  // Locked eye colors ignore any color the look asks for.
  eyeColorLocked?: boolean;
  // Look patterns this breed allows, besides its own.
  patterns: readonly Pattern[];
  // Per-pet variation, set from the pet seed (see variation.ts). Absent means the breed's own values.
  tailFluff?: number;
  markingIntensity?: number;
  oneEarFlop?: boolean;
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
  attributeRanges: BreedRanges;
  blurb: string;
};

export type Pose = {
  sit: number;
  lie: number;
  walk: number;
  paw: number;
  pant: number;
  headDown: number;
  headRest: number;
  headTurn: number;
  eyes: number;
  wagAmp: number;
  breathAmp: number;
  breathRate: number;
  squint: number;
  spineArch: number;
  crouch: number;
  // Cuddle channels. Offsets are actor-local pixels and angles are radians.
  headDx: number;
  headDy: number;
  headRot: number;
  // Positive bends the ears back, negative perks them up.
  earBack: number;
  torsoShift: number;
  snoutScale: number;
  tailLift: number;
  // 0 = upright, 1 = on its back.
  belly: number;
  knead: number;
  paddle: number;
  kick: number;
  shake: number;
};

export type IdleMode = 'still' | 'pant' | 'purr' | 'nap' | 'walk';

export type Task = {
  type: TaskType;
  stage: string;
  t: number;
  kind?: 'eat' | 'drink';
  bats: number;
  cool: number;
  poi?: { x: number; y: number; face?: 1 | -1 };
};

export type Idle = {
  mode: IdleMode;
  t: number;
  dur: number;
  target: Vec | null;
  sit: boolean;
  arrived: boolean;
  // World time of the last spontaneous bark or meow, so they stay rare.
  voicedAt?: number;
};

export type Bark = {
  active: boolean;
  t: number;
  fired: [boolean, boolean];
  open: number;
  sound: boolean;
};

export type CuddleZone = 'head' | 'back' | 'nose' | 'belly';

export type CuddlePhase =
  | 'approach'
  | 'settle'
  | 'waiting'
  | 'rollDown'
  | 'rollOver'
  | 'belly'
  | 'rollBack'
  | 'hold'
  | 'unturn'
  | 'shake'
  | 'swat'
  | 'leave';

export type CuddleExit = 'mode' | 'tolerance' | 'timeout';

export type CuddleReactionKind = 'boop' | 'headShake' | 'flinch' | 'scratch' | 'swat';

export type CuddleReaction = { kind: CuddleReactionKind; t: number; dur: number; side: 1 | -1 };

export type CuddleState = {
  params: CuddleParams;
  phase: CuddlePhase;
  t: number;
  // Seconds since the last valid touch movement, and since a touch of any kind.
  touchT: number;
  sinceTouch: number;
  touchX: number | null;
  zone: CuddleZone | null;
  strokes: number;
  continuity: number;
  sustained: number;
  tolerance: number;
  petted: number;
  reaction: CuddleReaction | null;
  boopTimes: number[];
  kickT: number;
  kickCool: number;
  buntT: number;
  tiltT: number;
  tiltNext: number;
  tiltSide: 1 | -1;
  kneading: boolean;
  purring: boolean;
  trap: boolean;
  trapTried: boolean;
  exit: CuddleExit | null;
  leaveTarget: Vec | null;
  perkT: number;
  announced: boolean;
  // One-shot flag for the sound or event of the current phase.
  fired: boolean;
};

export type CuddleOut = { type: 'exit'; reason: CuddleExit } | { type: 'done'; petted: number };

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
  look: Look | null;
  variant: Variant;
  asleep: boolean;
  mouth: Vec;
  anchors: Anchors;
  // 0..1, how much this pet likes cuddling. It sets how soon it escalates and how long it stays.
  cuddleAffinity: number;
  cuddle: CuddleState | null;
  cuddleOut: CuddleOut[];
};

export type Anchors = {
  // nearEye, farEye and top are in head space (relative to head x and y, before pitch).
  head: {
    x: number;
    y: number;
    pitch: number;
    radius: number;
    nearEye: Vec;
    farEye: Vec;
    farEyeAlpha: number;
    top: Vec;
  };
  neck: { x: number; y: number };
  torso: { theta: number; dy: number; pivot: { x: number; y: number } };
  paws: { x: number; y: number; shin: number }[];
  scale: number;
  facing: 1 | -1;
};

export type Particle = { x: number; y: number; v: number; ph: number };

// Cuddle content clips. Boop, flinch, swat, and shake-off stay silent.
export type CuddleSound = 'cuddle_purr' | 'cuddle_happy' | 'cuddle_pant';

export type SoundEvent = {
  actorId: string;
  sound: 'bark' | 'meow' | CuddleSound;
  rate: number;
};

export type World = {
  actors: Actor[];
  items: Item[];
  pointerTarget: PointerTarget;
  waterLevel: number;
  bowlFill: number;
  pendingBowlDrinks: number;
  t: number;
  rng: () => number;
  scene: Scene;
  reducedMotion: boolean;
  particles: Particle[];
  sounds: SoundEvent[];
  // Debug rendering only: draw every actor as a flat black silhouette.
  silhouette?: boolean;
  // Pets never nap on their own (the adoption preview keeps them awake).
  noNap?: boolean;
};

export type ActorSource = {
  id: string;
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  equipped: Equipped;
  look?: Look | null;
  asleep: boolean;
  cuddleAffinity?: number;
  // The pet seed, for per-pet variation inside the breed.
  seed?: number;
};
