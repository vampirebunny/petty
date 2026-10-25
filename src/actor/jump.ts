import { stageDayThresholds } from '../sim/config';
import { breedById } from './breeds';
import { geomOf, PET_SIZE } from './geometry';
import { baseYaw } from './turn';
import type { Actor, Species } from './types';

// One config for every jump. Durations are milliseconds. Heights are body-heights
// and distances are body-lengths. The stepper reads this object and does not
// keep its own copies of these numbers.
export type JumpParams = {
  height: number;
  distance: number;
  anticipationMs: number;
  wiggle: boolean;
  gravity: number;
  squashAmount: number;
  landingSquashAmount: number;
  takeoffMs: number;
  landingMs: number;
  recoveryMs: number;
  wiggleMs: number;
  // How fast the tail and ears catch the body. Higher is tighter.
  follow: number;
  // Share of body pitch the head cancels. Cats stay nearly level.
  headHold: number;
  // Nose-up angle at takeoff, in degrees.
  pitchDeg: number;
};

export type JumpLeg = { x: number; y: number; plant: boolean };

export const jumpConfig = {
  dog: {
    height: 0.8,
    distance: 1.5,
    anticipationMs: 140,
    wiggle: false,
    gravity: 680,
    squashAmount: 1,
    landingSquashAmount: 1,
    takeoffMs: 70,
    landingMs: 180,
    recoveryMs: 200,
    wiggleMs: 0,
    follow: 10,
    headHold: 0.5,
    pitchDeg: 16,
  } satisfies JumpParams,
  cat: {
    height: 1.3,
    distance: 1,
    anticipationMs: 220,
    wiggle: true,
    gravity: 1050,
    squashAmount: 1,
    landingSquashAmount: 1,
    takeoffMs: 65,
    landingMs: 170,
    recoveryMs: 180,
    wiggleMs: 300,
    follow: 26,
    headHold: 0.92,
    pitchDeg: 14,
  } satisfies JumpParams,
  age: {
    puppyHeight: 0.7,
    seniorHeight: 0.5,
    seniorDistance: 0.7,
    seniorAnticipation: 1.5,
    puppySquash: 1.4,
    seniorSquash: 0.35,
    seniorRecovery: 1.45,
  },
  agility: { base: 0.8, span: 0.4 },
  // How far above the species default an obstacle may push a jump, in body-heights.
  heightCap: 1.8,
  fastAnticipationMs: 60,
  obstacleMargin: 0.15,
  stretchMs: 60,
  backPawMs: 50,
  squashRecoverMs: 120,
  dustMs: 250,
  dustCount: 3,
  anticipation: { drop: 0.1, scaleY: 0.92, scaleX: 1.06, pitch: 0.4 },
  takeoff: { scaleY: 1.08, scaleX: 0.95 },
  landing: { scaleY: 0.9, scaleX: 1.08, dip: 0.08 },
  shadow: { size: 0.6, opacity: 0.5 },
  bounceFraction: 0.18,
  bounceSquash: 0.45,
  hurdleApproach: 72,
  hurdlePast: 52,
  // Foot targets are fractions of leg length. x is forward, y is down from the hip.
  // A planted foot ignores y and sits on the ground line.
  legs: {
    crouch: { fore: { x: 0.05, y: 0.9, plant: true }, hind: { x: -0.04, y: 0.9, plant: true } },
    push: { fore: { x: 0.1, y: 0.42, plant: false }, hind: { x: -0.22, y: 0.93, plant: true } },
    rise: { fore: { x: 0.06, y: 0.26, plant: false }, hind: { x: -0.52, y: 0.64, plant: false } },
    apex: { fore: { x: 0.02, y: 0.2, plant: false }, hind: { x: -0.08, y: 0.2, plant: false } },
    fall: { fore: { x: 0.48, y: 0.68, plant: false }, hind: { x: -0.24, y: 0.34, plant: false } },
    front: { fore: { x: 0.3, y: 0.93, plant: true }, hind: { x: -0.38, y: 0.4, plant: false } },
    absorb: { fore: { x: 0.12, y: 0.93, plant: true }, hind: { x: -0.08, y: 0.93, plant: true } },
  },
};

export type JumpPhase =
  | 'turn'
  | 'wiggle'
  | 'anticipation'
  | 'takeoff'
  | 'airborne'
  | 'landing'
  | 'recovery'
  | 'bounce';

export type JumpDust = { x: number; y: number; t: number; life: number; r: number };

export type JumpVisual = {
  pitch: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  fore: JumpLeg;
  hind: JumpLeg;
  blend: number;
  ear: number;
  tail: number;
  head: number;
  hip: number;
  wobble: number;
};

export type JumpOut = { type: 'land' };

export type JumpState = {
  phase: JumpPhase;
  t: number;
  species: Species;
  fast: boolean;
  reduced: boolean;
  running: boolean;
  quiet: boolean;
  didBounce: boolean;
  landX: number | null;
  heightPx: number;
  apex: number;
  distancePx: number;
  gravity: number;
  v0: number;
  airTime: number;
  vx: number;
  x0: number;
  face: 1 | -1;
  bodyH: number;
  bodyLenPx: number;
  anticipation: number;
  takeoff: number;
  landing: number;
  recovery: number;
  wiggleDur: number;
  squash: number;
  landSquash: number;
  follow: number;
  headHold: number;
  pitchPeak: number;
  puppy: number;
  tailLag: number;
  earLag: number;
  dust: JumpDust[];
  visual: JumpVisual;
  z0: number;
  landZ: number;
};

export type JumpRequest = {
  targetX?: number;
  // Apex in body-heights. Replaces the species default, then age and agility apply.
  height?: number;
  // Horizontal travel in body-lengths, used when targetX is omitted.
  distance?: number;
  // World-pixel height of something to clear. The apex is raised to clear it, then clamped.
  obstacleHeight?: number;
  // Absolute apex in world pixels. Still clamped by the age ceiling.
  heightPx?: number;
  fast?: boolean;
  reduced?: boolean;
  // Omit to use the species default. false skips the cat butt wiggle.
  wiggle?: boolean;
  // Height of the surface the pet lands on. The arc starts from the current z.
  landZ?: number;
  onLand?: (actor: Actor) => void;
  // Landing thud. Nothing plays until a caller passes this.
  onThud?: (actor: Actor) => void;
};

const landers = new WeakMap<Actor, (actor: Actor) => void>();
const thuds = new WeakMap<Actor, (actor: Actor) => void>();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function ease(t: number): number {
  return smoothstep(0, 1, t);
}

export function ageJumpMods(ageDays: number): {
  height: number;
  distance: number;
  anticipation: number;
  squash: number;
  recovery: number;
  puppy: number;
  senior: number;
} {
  const young = smoothstep(0, stageDayThresholds[1], ageDays);
  const senior = smoothstep(stageDayThresholds[2], stageDayThresholds[3], ageDays);
  const puppy = 1 - young;
  const { age } = jumpConfig;
  return {
    height: lerp(lerp(age.puppyHeight, 1, young), age.seniorHeight, senior),
    distance: lerp(1, age.seniorDistance, senior),
    anticipation: lerp(1, age.seniorAnticipation, senior),
    squash: lerp(lerp(age.puppySquash, 1, young), age.seniorSquash, senior),
    recovery: lerp(1, age.seniorRecovery, senior),
    puppy,
    senior,
  };
}

function speciesOf(actor: Actor): Species {
  return breedById(actor.breedId)?.species === 'cat' ? 'cat' : 'dog';
}

function paramsOf(species: Species): JumpParams {
  return species === 'cat' ? jumpConfig.cat : jumpConfig.dog;
}

export type ResolvedJump = {
  species: Species;
  heightPx: number;
  distancePx: number;
  gravity: number;
  anticipation: number;
  takeoff: number;
  landing: number;
  recovery: number;
  wiggleDur: number;
  squash: number;
  landSquash: number;
  follow: number;
  headHold: number;
  pitchPeak: number;
  puppy: number;
  bodyH: number;
  bodyLenPx: number;
  prep: number;
  airTime: number;
};

function bodySize(actor: Actor): { bodyH: number; bodyLen: number; scale: number } | null {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return null;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const scale = actor.anchors.scale > 0 ? actor.anchors.scale : PET_SIZE * geom.sc;
  return { bodyH: geom.bodyH, bodyLen: geom.bodyLen, scale };
}

// Seconds of crouch plus push before the feet leave the ground.
export function jumpPrepSeconds(actor: Actor, request: JumpRequest = {}): number {
  return resolveJump(actor, request)?.prep ?? 0;
}

export function resolveJump(actor: Actor, request: JumpRequest = {}): ResolvedJump | null {
  const sized = bodySize(actor);
  if (!sized) {
    return null;
  }
  const species = speciesOf(actor);
  const params = paramsOf(species);
  const age = ageJumpMods(actor.displayAgeDays);
  const agile = jumpConfig.agility.base + jumpConfig.agility.span * clamp(actor.stats.agility, 0, 1);
  const worldH = sized.bodyH * sized.scale;
  const worldL = sized.bodyLen * sized.scale;
  const capBodies = params.height * lerp(jumpConfig.heightCap, jumpConfig.age.seniorHeight, age.senior) * agile;
  let bodies = (request.height ?? params.height) * age.height * agile;
  if (request.heightPx != null && worldH > 1) {
    bodies = request.heightPx / worldH;
  }
  if (request.obstacleHeight != null && worldH > 1) {
    const margin = jumpConfig.obstacleMargin * worldH;
    bodies = Math.max(bodies, (request.obstacleHeight + margin) / worldH);
  }
  bodies = Math.min(Math.max(bodies, 0.05), Math.max(capBodies, 0.05));
  const z0 = Math.max(0, actor.z);
  const landZ = request.landZ ?? 0;
  let heightPx = bodies * worldH;
  if (landZ > z0) {
    heightPx = Math.max(heightPx, landZ - z0 + 0.3 * worldH);
  }
  const distancePx = (request.distance ?? params.distance) * age.distance * agile * worldL;
  const fast = request.fast === true;
  const reduced = request.reduced === true;
  const wantsWiggle = request.wiggle ?? params.wiggle;
  const wiggleDur = wantsWiggle && !fast && !reduced ? params.wiggleMs / 1000 : 0;
  let anticipation = (params.anticipationMs / 1000) * age.anticipation;
  if (fast || reduced) {
    anticipation = Math.min(anticipation, jumpConfig.fastAnticipationMs / 1000);
  }
  const takeoff = params.takeoffMs / 1000;
  const gravity = params.gravity;
  const v0 = Math.sqrt(2 * gravity * Math.max(heightPx, 1));
  return {
    species,
    heightPx,
    distancePx,
    gravity,
    anticipation,
    takeoff,
    landing: params.landingMs / 1000,
    recovery: (params.recoveryMs / 1000) * age.recovery,
    wiggleDur,
    squash: params.squashAmount * age.squash,
    landSquash: params.landingSquashAmount * age.squash,
    follow: params.follow,
    headHold: params.headHold,
    pitchPeak: (params.pitchDeg * Math.PI) / 180,
    puppy: reduced || fast ? 0 : age.puppy,
    bodyH: sized.bodyH,
    bodyLenPx: worldL,
    prep: wiggleDur + anticipation + takeoff,
    airTime: (2 * v0) / gravity,
  };
}

function blankVisual(): JumpVisual {
  return {
    pitch: 0,
    dy: 0,
    scaleX: 1,
    scaleY: 1,
    fore: { x: 0.1, y: 0.9, plant: true },
    hind: { x: -0.1, y: 0.9, plant: true },
    blend: 0,
    ear: 0,
    tail: 0,
    head: 0,
    hip: 0,
    wobble: 0,
  };
}

function scaleOf(scaleY: number, scaleX: number, amount: number): { scaleX: number; scaleY: number } {
  return {
    scaleY: 1 - (1 - scaleY) * amount,
    scaleX: 1 + (scaleX - 1) * amount,
  };
}

function lerpLeg(a: JumpLeg, b: JumpLeg, t: number): JumpLeg {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    plant: t < 0.5 ? a.plant : b.plant,
  };
}

function poseLegs(jump: JumpState): { fore: JumpLeg; hind: JumpLeg; blend: number } {
  const legs = jumpConfig.legs;
  const u = jump.airTime > 0 ? clamp(jump.t / jump.airTime, 0, 1) : 0;
  if (jump.phase === 'wiggle' || jump.phase === 'turn') {
    return { fore: legs.crouch.fore, hind: legs.crouch.hind, blend: 0 };
  }
  if (jump.phase === 'anticipation') {
    const k = ease(jump.anticipation > 0 ? jump.t / jump.anticipation : 1);
    return { fore: legs.crouch.fore, hind: legs.crouch.hind, blend: k };
  }
  if (jump.phase === 'takeoff') {
    const k = ease(jump.takeoff > 0 ? jump.t / jump.takeoff : 1);
    return { fore: lerpLeg(legs.crouch.fore, legs.push.fore, k), hind: lerpLeg(legs.crouch.hind, legs.push.hind, k), blend: 1 };
  }
  if (jump.phase === 'airborne' || jump.phase === 'bounce') {
    let fore = legs.rise.fore;
    let hind = legs.rise.hind;
    if (u < 0.25) {
      fore = legs.rise.fore;
      hind = legs.rise.hind;
    } else if (u < 0.5) {
      const k = (u - 0.25) / 0.25;
      fore = lerpLeg(legs.rise.fore, legs.apex.fore, k);
      hind = lerpLeg(legs.rise.hind, legs.apex.hind, k);
    } else if (u < 0.75) {
      const k = (u - 0.5) / 0.25;
      fore = lerpLeg(legs.apex.fore, legs.fall.fore, k);
      hind = lerpLeg(legs.apex.hind, legs.fall.hind, k);
    } else {
      fore = legs.fall.fore;
      hind = legs.fall.hind;
    }
    return { fore, hind, blend: 1 };
  }
  if (jump.phase === 'landing') {
    const back = jumpConfig.backPawMs / 1000;
    if (jump.t < back) {
      return { fore: legs.front.fore, hind: legs.front.hind, blend: 1 };
    }
    const k = ease(clamp((jump.t - back) / Math.max(jump.landing - back, 0.01), 0, 1));
    return { fore: lerpLeg(legs.front.fore, legs.absorb.fore, k), hind: lerpLeg(legs.front.hind, legs.absorb.hind, k), blend: 1 };
  }
  const k = 1 - ease(jump.recovery > 0 ? clamp(jump.t / jump.recovery, 0, 1) : 1);
  return { fore: legs.absorb.fore, hind: legs.absorb.hind, blend: k };
}

function sampleVisual(jump: JumpState): JumpVisual {
  const visual = blankVisual();
  const legs = poseLegs(jump);
  visual.fore = legs.fore;
  visual.hind = legs.hind;
  visual.blend = legs.blend;
  const drop = jump.bodyH * jumpConfig.anticipation.drop;
  const dip = jump.bodyH * jumpConfig.landing.dip;
  if (jump.phase === 'wiggle') {
    const cycles = 2.5;
    const u = jump.wiggleDur > 0 ? jump.t / jump.wiggleDur : 0;
    visual.hip = Math.sin(u * Math.PI * 2 * cycles) * 7;
  }
  if (jump.phase === 'anticipation') {
    const k = ease(jump.anticipation > 0 ? jump.t / jump.anticipation : 1);
    const squash = scaleOf(jumpConfig.anticipation.scaleY, jumpConfig.anticipation.scaleX, jump.squash * k);
    visual.scaleX = squash.scaleX;
    visual.scaleY = squash.scaleY;
    visual.dy = drop * k;
    visual.pitch = -jump.pitchPeak * jumpConfig.anticipation.pitch * k;
    visual.ear = 0.45 * k;
    visual.tail = -0.55 * k;
  }
  if (jump.phase === 'takeoff') {
    const k = ease(jump.takeoff > 0 ? jump.t / jump.takeoff : 1);
    const stretch = jumpConfig.stretchMs / 1000;
    const settled = jump.t < stretch ? 1 : 1 - clamp((jump.t - stretch) / Math.max(jump.takeoff - stretch, 0.01), 0, 1);
    const squash = scaleOf(jumpConfig.takeoff.scaleY, jumpConfig.takeoff.scaleX, jump.squash * settled);
    visual.scaleX = squash.scaleX;
    visual.scaleY = squash.scaleY;
    visual.dy = drop * (1 - k);
    visual.pitch = -jump.pitchPeak * lerp(jumpConfig.anticipation.pitch, 1, k);
    visual.ear = lerp(0.45, 0.2, k);
  }
  if (jump.phase === 'airborne' || jump.phase === 'bounce') {
    const vz = jump.v0 - jump.gravity * jump.t;
    const tilt = jump.v0 > 1 ? clamp(vz / jump.v0, -1, 1) : 0;
    visual.pitch = -jump.pitchPeak * tilt;
    const stretch = jumpConfig.stretchMs / 1000;
    if (jump.phase === 'airborne' && jump.t < stretch) {
      const settled = 1 - jump.t / stretch;
      const squash = scaleOf(jumpConfig.takeoff.scaleY, jumpConfig.takeoff.scaleX, jump.squash * settled * 0.5);
      visual.scaleX = squash.scaleX;
      visual.scaleY = squash.scaleY;
    }
  }
  if (jump.phase === 'landing') {
    const recover = jumpConfig.squashRecoverMs / 1000;
    const k = 1 - ease(clamp(jump.t / recover, 0, 1));
    const amount = jump.landSquash * (jump.quiet ? jumpConfig.bounceSquash : 1) * k;
    const squash = scaleOf(jumpConfig.landing.scaleY, jumpConfig.landing.scaleX, amount);
    visual.scaleX = squash.scaleX;
    visual.scaleY = squash.scaleY;
    visual.dy = dip * k;
    visual.pitch = jump.pitchPeak * 0.35 * k;
    visual.wobble = jump.puppy * 0.08 * k;
    visual.ear = 0.15 * k;
  }
  if (jump.phase === 'recovery') {
    const k = 1 - ease(jump.recovery > 0 ? clamp(jump.t / jump.recovery, 0, 1) : 1);
    visual.dy = dip * 0.35 * k;
    visual.blend = legs.blend;
  }
  // In the air the tail and ears lag the body pitch by chasing it a few frames late.
  if (jump.phase === 'takeoff' || jump.phase === 'airborne' || jump.phase === 'bounce' || jump.phase === 'landing') {
    visual.tail += jump.tailLag - visual.pitch;
    visual.ear = Math.max(visual.ear, jump.earLag);
  }
  visual.head = -visual.pitch * jump.headHold;
  if (jump.phase === 'landing' || jump.phase === 'bounce') {
    visual.pitch += Math.sin(jump.t * 28) * visual.wobble;
  }
  return visual;
}

function follow(jump: JumpState, dt: number): void {
  const pitch = jump.visual.pitch;
  const gain = 1 - Math.exp(-dt * jump.follow);
  jump.tailLag += (pitch - jump.tailLag) * gain;
  const earTarget = jump.phase === 'anticipation' ? 0.45 : Math.max(0, -pitch * 0.8);
  jump.earLag += (earTarget - jump.earLag) * gain;
}

function spawnDust(actor: Actor, jump: JumpState): void {
  if (jump.reduced || jump.quiet) {
    return;
  }
  const life = jumpConfig.dustMs / 1000;
  const count = jumpConfig.dustCount;
  for (let i = 0; i < count; i += 1) {
    jump.dust.push({
      x: actor.x + jump.face * jump.bodyLenPx * 0.28 + (i - (count - 1) / 2) * 7,
      y: actor.y + 2,
      t: 0,
      life,
      r: 3.5 + i * 1.6,
    });
  }
}

function fireLand(actor: Actor): void {
  actor.jumpOut.push({ type: 'land' });
  const land = landers.get(actor);
  const thud = thuds.get(actor);
  landers.delete(actor);
  thuds.delete(actor);
  land?.(actor);
  thud?.(actor);
}

function beginAir(actor: Actor, jump: JumpState, height: number, bounce: boolean): void {
  jump.phase = bounce ? 'bounce' : 'airborne';
  jump.t = 0;
  jump.apex = height;
  const z0 = bounce ? 0 : jump.z0;
  const landZ = bounce ? 0 : jump.landZ;
  jump.v0 = Math.sqrt(2 * jump.gravity * Math.max(height, 1));
  const tUp = jump.v0 / jump.gravity;
  const tDown = Math.sqrt((2 * Math.max(z0 + height - landZ, 1)) / jump.gravity);
  jump.airTime = tUp + tDown;
  if (!bounce && jump.landX != null) {
    jump.vx = (jump.landX - actor.x) / jump.airTime;
  } else if (!bounce) {
    jump.vx = jump.face * (jump.distancePx / jump.airTime);
  } else {
    jump.vx = jump.running ? jump.face * Math.min(Math.abs(jump.distancePx) / Math.max(jump.airTime, 0.05), 160) * 0.35 : 0;
  }
  jump.x0 = actor.x;
  actor.z = Math.max(jump.z0, 0.01);
  actor.vz = jump.v0;
}

function enter(jump: JumpState, phase: JumpPhase): void {
  jump.phase = phase;
  jump.t = 0;
}

export function cancelJump(actor: Actor): void {
  actor.jump = null;
  actor.z = 0;
  actor.vz = 0;
  landers.delete(actor);
  thuds.delete(actor);
}

export function takeJumpOut(actor: Actor): JumpOut[] {
  const out = actor.jumpOut;
  actor.jumpOut = [];
  return out;
}

export function jump(actor: Actor, request: JumpRequest = {}): boolean {
  if (actor.jump || actor.asleep) {
    return false;
  }
  const resolved = resolveJump(actor, request);
  if (!resolved) {
    return false;
  }
  const face: 1 | -1 = request.targetX != null && Math.abs(request.targetX - actor.x) > 4 ? (request.targetX >= actor.x ? 1 : -1) : actor.face >= 0 ? 1 : -1;
  actor.face = face;
  if (request.onLand) {
    landers.set(actor, request.onLand);
  }
  if (request.onThud) {
    thuds.set(actor, request.onThud);
  }
  const state: JumpState = {
    phase: 'turn',
    t: 0,
    species: resolved.species,
    fast: request.fast === true,
    reduced: request.reduced === true,
    running: actor.speed > 14,
    quiet: false,
    didBounce: false,
    landX: request.targetX ?? null,
    heightPx: resolved.heightPx,
    apex: resolved.heightPx,
    distancePx: resolved.distancePx,
    gravity: resolved.gravity,
    v0: 0,
    airTime: resolved.airTime,
    vx: 0,
    x0: actor.x,
    face,
    bodyH: resolved.bodyH,
    bodyLenPx: resolved.bodyLenPx,
    anticipation: resolved.anticipation,
    takeoff: resolved.takeoff,
    landing: resolved.landing,
    recovery: resolved.recovery,
    wiggleDur: resolved.wiggleDur,
    squash: resolved.squash,
    landSquash: resolved.landSquash,
    follow: resolved.follow,
    headHold: resolved.headHold,
    pitchPeak: resolved.pitchPeak,
    puppy: resolved.puppy,
    tailLag: 0,
    earLag: 0,
    dust: [],
    visual: blankVisual(),
    z0: Math.max(0, actor.z),
    landZ: request.landZ ?? 0,
  };
  actor.jump = state;
  state.visual = sampleVisual(state);
  return true;
}

function advance(actor: Actor, jump: JumpState): void {
  if (jump.phase === 'turn') {
    const aligned = !actor.turning && actor.lead <= 0 && Math.abs(baseYaw(actor.face) - actor.yaw) <= 0.12;
    if (aligned) {
      enter(jump, jump.wiggleDur > 0 ? 'wiggle' : 'anticipation');
    }
    return;
  }
  if (jump.phase === 'wiggle' && jump.t >= jump.wiggleDur) {
    enter(jump, 'anticipation');
    return;
  }
  if (jump.phase === 'anticipation' && jump.t >= jump.anticipation) {
    enter(jump, 'takeoff');
    return;
  }
  if (jump.phase === 'takeoff' && jump.t >= jump.takeoff) {
    beginAir(actor, jump, jump.heightPx, false);
    return;
  }
  if (jump.phase === 'airborne' && jump.t >= jump.airTime) {
    actor.x = jump.x0 + jump.vx * jump.airTime;
    actor.z = jump.landZ;
    actor.vz = 0;
    if (!jump.running) {
      actor.vx = 0;
      actor.vy = 0;
    }
    jump.quiet = false;
    enter(jump, 'landing');
    spawnDust(actor, jump);
    fireLand(actor);
    return;
  }
  if (jump.phase === 'landing' && jump.t >= jump.landing) {
    if (jump.quiet) {
      actor.jump = null;
      actor.z = jump.landZ;
      actor.vz = 0;
      return;
    }
    enter(jump, 'recovery');
    return;
  }
  if (jump.phase === 'recovery' && jump.t >= jump.recovery) {
    if (jump.landZ <= 0 && jump.puppy > 0.2 && !jump.didBounce) {
      jump.didBounce = true;
      jump.quiet = true;
      beginAir(actor, jump, jump.heightPx * jumpConfig.bounceFraction * jump.puppy, true);
      return;
    }
    actor.jump = null;
    actor.z = jump.landZ;
    actor.vz = 0;
    return;
  }
  if (jump.phase === 'bounce' && jump.t >= jump.airTime) {
    actor.x = jump.x0 + jump.vx * jump.airTime;
    actor.z = jump.landZ;
    actor.vz = 0;
    jump.landing = 0.12;
    jump.quiet = true;
    enter(jump, 'landing');
  }
}

export function stepJump(actor: Actor, dt: number): void {
  const jump = actor.jump;
  if (!jump) {
    return;
  }
  jump.t += dt;
  for (const puff of jump.dust) {
    puff.t += dt;
  }
  jump.dust = jump.dust.filter((puff) => puff.t < puff.life);
  advance(actor, jump);
  const live = actor.jump;
  if (!live) {
    return;
  }
  if (live.phase === 'airborne' || live.phase === 'bounce') {
    const u = Math.min(live.t, live.airTime);
    live.visual = sampleVisual(live);
    actor.z = Math.max(0, live.z0 + live.v0 * u - 0.5 * live.gravity * u * u);
    actor.vz = live.v0 - live.gravity * u;
    actor.vx = live.vx;
    actor.vy = 0;
    actor.x = live.x0 + live.vx * u;
  }
  const posing = actor.jump;
  if (!posing) {
    return;
  }
  posing.visual = sampleVisual(posing);
  follow(posing, dt);
  posing.visual = sampleVisual(posing);
}

export function jumpOwnsMotion(actor: Actor): boolean {
  const phase = actor.jump?.phase;
  return phase === 'airborne' || phase === 'bounce' || phase === 'turn' || phase === 'wiggle' || phase === 'anticipation' || phase === 'takeoff' || phase === 'landing';
}
