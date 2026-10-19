import type { Gait } from '../types';

// ---------------------------------------------------------------- gaits

export const gaitOrder: readonly Gait[] = ['walk', 'trot', 'canter', 'gallop'];

export type GaitDef = {
  // Share of the pet's top speed where this gait starts. It drops back 0.05 lower (hysteresis).
  enter: number;
  // Stride length as a multiple of leg length L.
  stride: number;
  // Share of the cycle a foot is on the ground.
  duty: number;
  // Foot phase offsets (0..1) in the order hind far, fore far, hind near, fore near.
  offsets: readonly [number, number, number, number];
  // Foot lift as a multiple of L.
  lift: number;
  // Body bounce in pixels per stride, and how much of the stride is a flight phase (0 for none).
  bounce: number;
  // Spine flex and ears and tail streaming back, 0..1.
  stretch: number;
  stream: number;
};

export const gaitDefs: Record<Gait, GaitDef> = {
  // Four beats, lateral sequence: hind far, fore far, hind near, fore near.
  walk: { enter: 0, stride: 0.38, duty: 0.7, offsets: [0, 0.25, 0.5, 0.75], lift: 0.14, bounce: 1, stretch: 0, stream: 0 },
  // Diagonal pairs: hind far with fore near, fore far with hind near.
  trot: { enter: 0.56, stride: 0.62, duty: 0.55, offsets: [0, 0.5, 0.5, 0], lift: 0.18, bounce: 2.4, stretch: 0, stream: 0 },
  // Three beats: trailing hind, then the diagonal pair, then the leading fore.
  canter: { enter: 0.74, stride: 0.86, duty: 0.42, offsets: [0, 0.3, 0.3, 0.62], lift: 0.22, bounce: 3.8, stretch: 0.45, stream: 0.35 },
  // Rotary: both hinds, then both fores, with a flight phase between.
  gallop: { enter: 0.9, stride: 1.18, duty: 0.3, offsets: [0.12, 0.5, 0, 0.62], lift: 0.26, bounce: 5.6, stretch: 1, stream: 1 },
};

export const gaitHysteresis = 0.05;
export const gaitBlendSeconds = 0.15;

// A pet that is too tired is held to this gait.
export const tiredGait: Gait = 'trot';

// Fastest speed (share of top speed) each gait lets a pet reach.
export const gaitSpeedCap: Record<Gait, number> = { walk: 0.55, trot: 0.72, canter: 0.88, gallop: 1 };

// Stamina per second. Canter and gallop spend it, slower gaits and rest give it back.
export const staminaDrainPerSec: Record<Gait, number> = { walk: 0, trot: 0, canter: 0.035, gallop: 0.075 };
export const staminaRecoverPerSec = 0.07;
export const tiredBelow = 0.18;
export const restedAbove = 0.5;

// ---------------------------------------------------------------- life stages

export type StageProfile = {
  maxSpeed: number;
  maxGait: Gait;
  jumpHeight: number;
  // Chance multiplier for optional jumps and hops.
  jumpFreq: number;
  drain: number;
  // Speed of stamina recovery. Below 1 is slower.
  recovery: number;
  // Chance per chase of an overshoot, and of a tumble when it overshoots at speed.
  tumble: number;
  bow: number;
  zoomies: number;
  burst: number;
  // 0..1 willingness and ability to leap-catch.
  leapCatch: number;
  walkToToy: number;
  // Below 1 slows the lie down and stand up.
  slowStand: number;
};

export type LifeStageKey = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult';

export const stageProfiles: Record<LifeStageKey, StageProfile> = {
  // Gallop is allowed but tires fast, so it comes in short bursts. Clumsy, loves a play bow.
  puppy: { maxSpeed: 0.85, maxGait: 'gallop', jumpHeight: 0.7, jumpFreq: 1, drain: 2, recovery: 1.2, tumble: 0.28, bow: 0.8, zoomies: 0.5, burst: 0.5, leapCatch: 0, walkToToy: 0, slowStand: 1 },
  olderPuppy: { maxSpeed: 0.95, maxGait: 'gallop', jumpHeight: 0.9, jumpFreq: 1.1, drain: 1.5, recovery: 1.1, tumble: 0.16, bow: 0.6, zoomies: 0.8, burst: 0.6, leapCatch: 0.2, walkToToy: 0, slowStand: 1 },
  // The fastest stage, with the most zoomies and the big leaps.
  adolescent: { maxSpeed: 1.15, maxGait: 'gallop', jumpHeight: 1.25, jumpFreq: 1.3, drain: 1, recovery: 1, tumble: 0.1, bow: 0.45, zoomies: 1, burst: 1, leapCatch: 1, walkToToy: 0, slowStand: 1 },
  // Precise and anticipating.
  adult: { maxSpeed: 1, maxGait: 'gallop', jumpHeight: 1, jumpFreq: 1, drain: 1, recovery: 1, tumble: 0.03, bow: 0.25, zoomies: 0.35, burst: 0.5, leapCatch: 1, walkToToy: 0, slowStand: 1 },
};

// Senior sub-stages follow vitality, so care and rejuvenation move a pet back toward adult values.
export type SeniorAnchor = { vitality: number; profile: StageProfile };

export const seniorAnchors: readonly SeniorAnchor[] = [
  { vitality: 0.35, profile: { maxSpeed: 0.55, maxGait: 'canter', jumpHeight: 0.35, jumpFreq: 0.3, drain: 2, recovery: 0.55, tumble: 0.1, bow: 0.05, zoomies: 0, burst: 0.05, leapCatch: 0, walkToToy: 0.55, slowStand: 0.5 } },
  { vitality: 0.5, profile: { maxSpeed: 0.75, maxGait: 'gallop', jumpHeight: 0.6, jumpFreq: 0.5, drain: 1.5, recovery: 0.7, tumble: 0.08, bow: 0.1, zoomies: 0.05, burst: 0.15, leapCatch: 0.35, walkToToy: 0.3, slowStand: 0.7 } },
  { vitality: 0.7, profile: { maxSpeed: 0.9, maxGait: 'gallop', jumpHeight: 0.85, jumpFreq: 0.8, drain: 1.2, recovery: 0.9, tumble: 0.05, bow: 0.15, zoomies: 0.15, burst: 0.3, leapCatch: 0.8, walkToToy: 0.1, slowStand: 0.85 } },
  { vitality: 1, profile: stageProfiles.adult },
];

// ---------------------------------------------------------------- jumps and landings

export const gravity = 900;
export const jumpRiseTime = (height: number): number => Math.sqrt((2 * height) / gravity);

export const jumpHeights = {
  // A small playful hop (after a play bow, over a low obstacle).
  hop: 16,
  // A leap to catch a toy in the air, up to this height.
  leap: 70,
  // A pounce reaches this high at most.
  pounce: 28,
} as const;

// Landing absorb length in seconds.
export const landSeconds = 0.26;

// ---------------------------------------------------------------- play

export const bowHold = { min: 0.5, max: 1.5 };
export const stalkWiggle = { min: 0.5, max: 1.5 };
export const burstSeconds = { min: 0.5, max: 0.9 };
export const burstEvery = { min: 1.2, max: 3.5 };

// Speed variety per chase: the sampled share of top speed.
export const chaseSpeed = { min: 0.55, max: 1 };
