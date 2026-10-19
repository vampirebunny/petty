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
  // Play locomotion channels, all 0..1.
  // Legs tucked in the air.
  tuck: number;
  // Landing squash that absorbs the impact.
  land: number;
  // Dog play bow: front legs folded, chest low, rump up.
  bow: number;
  // Cat stalk: low crouch with the eyes on the toy.
  stalk: number;
  // Butt wiggle before a pounce.
  wiggle: number;
  // Ears and tail streaming back at a gallop.
  stream: number;
  // Spine flex and extend at canter and gallop.
  stretch: number;
  // Braking hard to turn: weight back, front feet forward.
  skid: number;
};

export type IdleMode = 'still' | 'pant' | 'purr' | 'nap' | 'walk' | 'zoom';

export type Task = {
  type: TaskType;
  stage: string;
  t: number;
  kind?: 'eat' | 'drink';
  bats: number;
  cool: number;
  // How long the current hold lasts (play bow, stalk wiggle, shake, chew), in seconds.
  hold?: number;
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

export type Gait = 'walk' | 'trot' | 'canter' | 'gallop';

// The gait the legs are in and the one they came from. `blend` runs 0 to 1 over about 150 ms.
export type GaitState = { current: Gait; from: Gait; blend: number };

// Play-relevant attributes as 0..1.
export type LocoStats = { stamina: number; agility: number; boldness: number; obedience: number };

export type JumpKind = 'hop' | 'leap' | 'pounce';

// A playdate director owns the actor. Home idle does not run while this is set.
export type DirectionPose =
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'jump'
  | 'pant'
  | 'paw'
  | 'bow'
  | 'stalk'
  | 'pounce'
  | 'celebrate'
  | 'sniff';

export type Direction = {
  target: Vec | null;
  pace: number;
  pose: DirectionPose;
  token: number;
};

// Choices made once per chase, from the seeded stream, the pet's energy and mood, and its age.
export type PlayState = {
  // Share of top speed this chase runs at.
  speedFrac: number;
  burstLeft: number;
  burstIn: number;
  // Seniors sometimes walk to the toy.
  walkToToy: boolean;
  // Whether this chase attempts leap-catches.
  leap: boolean;
  // Whether the pet brings the toy back.
  returns: boolean;
  // A play bow has already happened this chase.
  bowed: boolean;
  overshoot: number;
  tumbled: boolean;
  // Set once a stalk or a pounce has happened this chase, so each happens at most once.
  stalked: boolean;
  pounced: boolean;
};

export type ZoomState = { leg: number; legs: number; first: number };

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
  gait: GaitState;
  // 0..1. Drains at canter and gallop, recovers when slower.
  stamina: number;
  // Too tired for the fastest gaits until it has recovered.
  tired: boolean;
  stats: LocoStats;
  // Needs as 0..1, used to size how lively play is.
  energy: number;
  mood: number;
  play: PlayState | null;
  zoom: ZoomState | null;
  // Seconds of landing absorb left after a jump, 0..1.
  land: number;
  jumpKind: JumpKind | null;
  // Seconds the current gait has been at canter or faster.
  topT: number;
  // Speed as a share of the pet's own top speed, for the legs.
  share: number;
  direction: Direction | null;
  // The direction token that already launched a jump, so a held jump fires once.
  directionJump: number;
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
  // The toy a play session uses. Default is the ball.
  toyKind?: string;
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
  // 0..1 energy and happiness, and the play attributes, for how the pet moves in play.
  energy?: number;
  mood?: number;
  stats?: LocoStats;
};
