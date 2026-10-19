import { stepItem } from '../items/physics';
import type { Item } from '../items/types';
import type { Scene } from './scenes';
import {
  burstEvery,
  burstSeconds,
  chaseSpeed,
  gaitBlendSeconds,
  gaitDefs,
  gaitHysteresis,
  gaitOrder,
  gravity,
  restedAbove,
  seniorAnchors,
  staminaDrainPerSec,
  staminaRecoverPerSec,
  stageProfiles,
  tiredBelow,
  tiredGait,
} from './data/locomotion';
import type { StageProfile } from './data/locomotion';
import { stageOf } from '../sim/attributes';
import type { Gait, GaitState, LocoStats, Vec } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------- life stage and modifiers

// The stage profile for an age. Seniors blend between anchors by vitality, so rejuvenation moves them toward adult.
export function stageProfileOf(ageDays: number, vitality: number): StageProfile {
  const stage = stageOf(ageDays);
  if (stage !== 'senior') {
    return stageProfiles[stage];
  }
  const v = clamp(vitality, seniorAnchors[0].vitality, 1);
  for (let i = 1; i < seniorAnchors.length; i += 1) {
    const lo = seniorAnchors[i - 1];
    const hi = seniorAnchors[i];
    if (v <= hi.vitality) {
      const t = (v - lo.vitality) / (hi.vitality - lo.vitality);
      const nearest = t < 0.5 ? lo.profile : hi.profile;
      const out = { ...nearest } as StageProfile;
      for (const key of Object.keys(out) as (keyof StageProfile)[]) {
        const a = lo.profile[key];
        const b = hi.profile[key];
        if (typeof a === 'number' && typeof b === 'number') {
          (out as Record<string, unknown>)[key] = lerp(a, b, t);
        }
      }
      return out;
    }
  }
  return seniorAnchors[seniorAnchors.length - 1].profile;
}

export type LocoMods = {
  // Multiplies the pet's top speed.
  maxSpeed: number;
  // Pixels per second squared when speeding up and slowing down.
  accel: number;
  decel: number;
  jumpHeight: number;
  // Stamina drain multiplier (higher is shorter time at canter and gallop).
  drain: number;
  recovery: number;
  // Willingness multiplier for pounces and leaps.
  daring: number;
};

const baseAccel = 900;

// Folds the life stage, the attributes and the weight index into one set of multipliers.
export function locoModsOf(profile: StageProfile, stats: LocoStats, weight: number): LocoMods {
  const over = clamp((weight - 0.25) / 0.75, 0, 1);
  const under = clamp((-weight - 0.25) / 0.75, 0, 1);
  const agile = 0.7 + 0.8 * stats.agility;
  return {
    maxSpeed: profile.maxSpeed * (1 - 0.2 * over),
    accel: baseAccel * agile,
    decel: baseAccel * 1.7 * agile,
    jumpHeight: profile.jumpHeight * (0.8 + 0.4 * stats.agility) * (1 - 0.35 * over),
    // Stamina stat lengthens time at canter and gallop. Being overweight or underweight shortens it.
    drain: (profile.drain / (0.6 + 0.8 * stats.stamina)) * (1 + 0.6 * over + 0.5 * under),
    recovery: profile.recovery,
    daring: 0.4 + 1.2 * stats.boldness,
  };
}

// ---------------------------------------------------------------- gait choice and legs

export function isGaitAllowed(gait: Gait, max: Gait): boolean {
  return gaitOrder.indexOf(gait) <= gaitOrder.indexOf(max);
}

// The fastest gait a pet may use now: its life stage, held to trot while tired.
export function maxGaitOf(profile: StageProfile, tired: boolean): Gait {
  return tired && isGaitAllowed(tiredGait, profile.maxGait) ? tiredGait : profile.maxGait;
}

// Picks the gait for a speed (as a share of top speed) with hysteresis: it steps up at a gait's `enter` and
// only steps back down 0.05 below it, so a speed hovering at a boundary does not flicker.
export function chooseGait(current: Gait, share: number, max: Gait): Gait {
  let index = gaitOrder.indexOf(current);
  const top = gaitOrder.indexOf(max);
  while (index < top && share >= gaitDefs[gaitOrder[index + 1]].enter) {
    index += 1;
  }
  while (index > 0 && share < gaitDefs[gaitOrder[index]].enter - gaitHysteresis) {
    index -= 1;
  }
  return gaitOrder[Math.min(index, top)];
}

export function newGaitState(): GaitState {
  return { current: 'walk', from: 'walk', blend: 1 };
}

// Moves the gait toward `next`. A change starts a blend over about 150 ms.
export function stepGait(state: GaitState, next: Gait, dt: number): void {
  if (next !== state.current) {
    state.from = state.current;
    state.current = next;
    state.blend = 0;
  }
  state.blend = Math.min(1, state.blend + dt / gaitBlendSeconds);
}

// Stride (pixels) for a gait at a speed share. It grows a little through the gait's own speed band.
export function strideOf(L: number, gait: Gait, share: number): number {
  const def = gaitDefs[gait];
  const index = gaitOrder.indexOf(gait);
  const next = gaitOrder[Math.min(gaitOrder.length - 1, index + 1)];
  const span = Math.max(0.05, gaitDefs[next].enter - def.enter) || 0.3;
  const within = clamp((share - def.enter) / span, 0, 1);
  return L * def.stride * (0.88 + 0.24 * within);
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

// Blended gait numbers, so stride, bounce and streaming change smoothly across a gait change.
export function blendedGait(state: GaitState, pick: (gait: Gait) => number): number {
  return lerp(pick(state.from), pick(state.current), smooth(state.blend));
}

// One foot's trajectory for a gait: planted and sliding back, then lifted and swung forward.
export function gaitFootFor(gait: Gait, leg: 0 | 1 | 2 | 3, phase: number, stride: number, lift: number): Vec {
  const def = gaitDefs[gait];
  const turn = Math.PI * 2;
  const u = ((((phase + def.offsets[leg] * turn) / turn) % 1) + 1) % 1;
  if (u < def.duty) {
    return { x: stride * (0.5 - u / def.duty), y: 0 };
  }
  const swing = (u - def.duty) / (1 - def.duty);
  return { x: stride * (swing - 0.5), y: -lift * Math.sin(Math.PI * swing) };
}

// The foot for the current blend of gaits.
export function blendedFoot(state: GaitState, leg: 0 | 1 | 2 | 3, phase: number, L: number, share: number): Vec {
  const make = (gait: Gait): Vec => gaitFootFor(gait, leg, phase, strideOf(L, gait, share), L * gaitDefs[gait].lift);
  if (state.blend >= 1 || state.from === state.current) {
    return make(state.current);
  }
  const a = make(state.from);
  const b = make(state.current);
  const t = smooth(state.blend);
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// How fast the leg phase turns so the planted foot matches the ground speed. A short-legged breed has a small
// stride at the same ground speed, so its phase turns faster: quick short steps.
export function phaseRate(state: GaitState, localSpeed: number, L: number, share: number): number {
  const duty = blendedGait(state, (g) => gaitDefs[g].duty);
  const stride = blendedGait(state, (g) => strideOf(L, g, share));
  if (stride <= 0) {
    return 0;
  }
  return Math.min(30, (Math.PI * 2 * duty * localSpeed) / stride);
}

// Body bounce (pixels) for the current gait blend. Canter and gallop spend part of the cycle in the air.
export function bounceOf(state: GaitState, phase: number, speedShare: number): number {
  const amp = blendedGait(state, (g) => gaitDefs[g].bounce);
  const air = blendedGait(state, (g) => (g === 'gallop' ? 1 : g === 'canter' ? 0.6 : 0));
  const wave = (1 - air) * Math.abs(Math.sin(phase)) + air * (0.5 + 0.5 * Math.sin(phase * 1 + 0.9));
  return -amp * wave * (0.55 + 0.45 * clamp(speedShare, 0, 1));
}

export function streamOf(state: GaitState): { stretch: number; stream: number } {
  return {
    stretch: blendedGait(state, (g) => gaitDefs[g].stretch),
    stream: blendedGait(state, (g) => gaitDefs[g].stream),
  };
}

// ---------------------------------------------------------------- stamina

// One tick of stamina. Canter and gallop spend it (more for a puppy, an overweight pet, or a low stamina stat);
// slower gaits give it back. A pet that runs out is held to trot until it has rested.
export function stepStamina(stamina: number, tired: boolean, gait: Gait, mods: LocoMods, dt: number): { stamina: number; tired: boolean } {
  const drain = staminaDrainPerSec[gait] * mods.drain;
  const gain = drain === 0 ? staminaRecoverPerSec * mods.recovery : 0;
  const next = clamp(stamina + (gain - drain) * dt, 0, 1);
  return { stamina: next, tired: tired ? next < restedAbove : next < tiredBelow };
}

// ---------------------------------------------------------------- speed variety

// A share of top speed for one chase, from the seeded stream and how lively the pet is. A tired, sad pet
// picks a slower pace; a lively one can pick anything up to full speed.
export function sampleChaseSpeed(roll: () => number, energy: number, mood: number): number {
  const lively = 0.6 * clamp(energy, 0, 1) + 0.4 * clamp(mood, 0, 1);
  const span = chaseSpeed.max - chaseSpeed.min;
  return chaseSpeed.min + span * roll() * (0.45 + 0.55 * lively);
}

export function nextBurstIn(roll: () => number): number {
  return burstEvery.min + roll() * (burstEvery.max - burstEvery.min);
}

export function burstLength(roll: () => number): number {
  return burstSeconds.min + roll() * (burstSeconds.max - burstSeconds.min);
}

// ---------------------------------------------------------------- jumps

export function jumpSpeed(height: number): number {
  return Math.sqrt(2 * gravity * Math.max(0, height));
}

export function airTime(height: number): number {
  return (2 * jumpSpeed(height)) / gravity;
}

// Where and when a flying item next comes down through `z`. Steps a copy of the item with the same physics.
export function predictCrossing(item: Item, scene: Scene, z: number, limitSeconds = 3): { x: number; y: number; t: number } | null {
  const copy: Item = { ...item };
  const dt = 1 / 60;
  for (let t = 0; t < limitSeconds; t += dt) {
    const before = copy.z;
    stepItem(copy, scene, dt);
    if (copy.vz < 0 && before >= z && copy.z <= z) {
      return { x: copy.x, y: copy.y, t: t + dt };
    }
    if (copy.state !== 'free') {
      return null;
    }
  }
  return null;
}

// Where an item comes to rest or first lands.
export function predictLanding(item: Item, scene: Scene): { x: number; y: number; t: number } | null {
  return predictCrossing(item, scene, 0.5);
}

// Impact of a landing, 0..1.2: faster and heavier is harder.
export function landImpact(vz: number, mass: number): number {
  return clamp(Math.abs(vz) / 420, 0, 1) * mass;
}
