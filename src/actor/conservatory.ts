import type { Facing } from './data/facing';
import { facingRing } from './data/facing';
import { earProfiles } from './data/breedShapes';
import { dogBreeds } from './breeds';
import { facingFit } from './facing';
import { bodyFrame, stageWidth, xRangeOf } from './geometry';
import type { Prop } from './scenes';
import { visualLifespanDays } from '../sim/config';

// Open-front cabana, 400×260. The anchor is the approach point on the room floor.
export const VIEW_W = 400;
export const VIEW_H = 260;
export const ANCHOR = { x: 200, y: 254 };

export const ART_CLEAR_H = 77;
export const ART_CLEAR_W = 252;
export const ART_CUSHION_W = 212;

// Margins so an adult dog clears the valance, the curtains, and the cushion.
// sideGap keeps a walkway on each side. The raw fit is wider than a room, and a cabana
// that spans the floor traps the dog behind it.
export const cabanaFit = {
  stand: 1.1,
  spin: 1.2,
  lie: 1.1,
  sideGap: 48,
} as const;

const STEP_RISE = 10;
const DECK_RISE = 20;

export const HOUSE_POINTS = {
  A: { x: 200, y: 254 },
  S: { x: 200, y: 238 },
  E: { x: 200, y: 214 },
  R: { x: 200, y: 210 },
} as const;

const IN_PATH = [HOUSE_POINTS.A, HOUSE_POINTS.S, HOUSE_POINTS.E, HOUSE_POINTS.R];
const OUT_PATH = [HOUSE_POINTS.R, HOUSE_POINTS.E, HOUSE_POINTS.S, HOUSE_POINTS.A];

const ART = { x0: 10, y0: 52, x1: 390, y1: 262 };
const BODY = { cx: 200, cy: 220, rx: 172, ry: 26 };

let passageHw: number | null = null;

// The deck art can be wider than a long dog can walk around. Keep the blocked middle
// inside every adult dog's reachable span so the room behind the cabana stays reachable.
function collisionHw(): number {
  if (passageHw != null) {
    return passageHw;
  }
  const box = { xMin: 28, xMax: stageWidth - 28 };
  const mid = (box.xMin + box.xMax) / 2;
  let room = Infinity;
  for (const breed of dogBreeds()) {
    const frame = bodyFrame(breed, visualLifespanDays, 0, 1, still, 0, 0, 0, 1000, 1, { yMin: 0, yMax: 1000 });
    const range = xRangeOf(box, frame.geom, frame.scale);
    room = Math.min(room, mid - range.lo, range.hi - mid);
  }
  passageHw = Math.max(48, Math.min(BODY.rx * SCALE, room - 36));
  return passageHw;
}

export type CabanaMetrics = {
  standH: number;
  spinW: number;
  lieW: number;
  scale: number;
};

const still = { sit: 0, lie: 0, walk: 0, headDown: 0, headRest: 0, pant: 0 };
const floor = { yMin: 0, yMax: 1000 };

let metrics: CabanaMetrics | null = null;

function earTop(breed: ReturnType<typeof dogBreeds>[number], view: 'side' | 'front' | 'back'): number {
  const octant = view === 'side' ? 'E' : view === 'front' ? 'S' : 'N';
  const frame = bodyFrame(breed, visualLifespanDays, 0, 1, still, 0, 0, 0, floor.yMax, 1, floor, 0, undefined, 0, facingFit(octant, octant, 1));
  const profile = earProfiles[breed.earType];
  const rise = profile.stiff ? frame.geom.headR * profile.height * Math.max(0.55, frame.geom.ear) : frame.geom.headR * 0.9;
  return -(frame.head.y - rise) * frame.scale;
}

function measure(): CabanaMetrics {
  let standH = 0;
  let spinW = 0;
  let lieW = 0;
  for (const breed of dogBreeds()) {
    standH = Math.max(standH, earTop(breed, 'side'), earTop(breed, 'front'), earTop(breed, 'back'));
    const side = bodyFrame(breed, visualLifespanDays, 0, 1, still, 0, 0, 0, floor.yMax, 1, floor, 0, undefined, 0, facingFit('E', 'E', 1));
    const nose = side.head.x + side.geom.tipX;
    const rump = -side.geom.bodyLen / 2;
    spinW = Math.max(spinW, (nose - rump) * side.scale);
    const lying = bodyFrame(
      breed,
      visualLifespanDays,
      0,
      1,
      { ...still, lie: 1 },
      0,
      0,
      0,
      floor.yMax,
      1,
      floor,
      0,
      undefined,
      0,
      facingFit('S', 'S', 1),
    );
    const g = lying.geom;
    const ears = g.headR * 2.4 * Math.max(1, g.ear);
    const torso = g.bodyH * 1.15;
    lieW = Math.max(lieW, (Math.max(ears, torso) + g.pawRx * 4) * lying.scale);
  }
  const ideal = Math.max(
    (cabanaFit.stand * standH) / ART_CLEAR_H,
    (cabanaFit.spin * spinW) / ART_CLEAR_W,
    (cabanaFit.lie * lieW) / ART_CUSHION_W,
  );
  const roomW = stageWidth - 56;
  const roomScale = (roomW - cabanaFit.sideGap * 2) / (ART.x1 - ART.x0);
  const scale = Math.min(ideal, roomScale);
  return { standH, spinW, lieW, scale };
}

export function cabanaMetrics(): CabanaMetrics {
  if (!metrics) {
    metrics = measure();
  }
  return metrics;
}

export function cabanaScale(): number {
  return cabanaMetrics().scale;
}

export const SCALE = cabanaScale();
export const HOUSE_WIDTH = VIEW_W * SCALE;
export const HOUSE_REST = 2;

export type HousePhase = 'front' | 'in' | 'spin' | 'between' | 'settle' | 'rest' | 'stretch' | 'out' | 'done';

export type HouseTask = {
  task: string;
  roll?: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
};

export type HouseRun = {
  phase: HousePhase;
  propId: string;
  flip: boolean;
  dir: 1 | -1;
  index: number;
  spinSteps: number;
  stepsDone: number;
  turnT: number;
  turnDur: number;
  between: 'sniff' | 'paw';
  betweenT: number;
  betweenDur: number;
  settleT: number;
  linger: number;
  stretchT: number;
  octant: Facing;
  octantFrom: Facing;
  octantBlend: number;
  spinning: boolean;
  face: 1 | -1;
  holdFace: boolean;
  headDown: number;
  lie: number;
  eyes: number;
  headRest: number;
  stretch: number;
  paw: number;
  stowAfter: boolean;
  pending: HouseTask | null;
  asleepNoted: boolean;
  leaving: boolean;
  moveAfter: { x: number; y: number } | null;
  gate: { x: number; y: number } | null;
  gated: boolean;
};

export function spinStepsFor(roll: number): 12 | 20 {
  return roll < 0.5 ? 12 : 20;
}

export function ringStep(octant: Facing, dir: 1 | -1): Facing {
  const index = facingRing.indexOf(octant);
  return facingRing[(index + (dir === 1 ? 1 : 7)) % 8];
}

export function octantAfter(start: Facing, steps: number, dir: 1 | -1): Facing {
  let octant = start;
  for (let i = 0; i < steps; i += 1) {
    octant = ringStep(octant, dir);
  }
  return octant;
}

function faceOf(octant: Facing): 1 | -1 {
  if (octant === 'W' || octant === 'NW' || octant === 'SW') {
    return -1;
  }
  return 1;
}

function look(run: HouseRun, octant: Facing, blend = 1): void {
  run.octantFrom = blend >= 1 ? octant : run.octantFrom;
  run.octant = octant;
  run.octantBlend = blend;
  run.spinning = blend < 1;
  run.face = faceOf(octant);
  run.holdFace = true;
}

export function houseLocal(svgX: number, svgY: number, flip: boolean): { x: number; y: number } {
  const x = flip ? ANCHOR.x * 2 - svgX : svgX;
  return { x: (x - ANCHOR.x) * SCALE, y: (svgY - ANCHOR.y) * SCALE };
}

export type HouseBlock = { x: number; y: number; hw: number; hd: number };

// The deck, stopping short of the front walk (viewBox y ≥ 250) so a path can pass in front.
export function houseBlocks(prop: Prop): HouseBlock[] {
  const at = houseLocal(BODY.cx, BODY.cy, prop.flip === true);
  return [
    {
      x: prop.x + at.x,
      y: prop.y + at.y,
      hw: Math.max(1, collisionHw()),
      hd: Math.max(1, BODY.ry * SCALE),
    },
  ];
}

export function houseContains(prop: Prop, x: number, y: number): boolean {
  const flip = prop.flip === true;
  const a = houseLocal(ART.x0, ART.y0, flip);
  const b = houseLocal(ART.x1, ART.y1, flip);
  const lx = x - prop.x;
  const ly = y - prop.y;
  return lx >= Math.min(a.x, b.x) && lx <= Math.max(a.x, b.x) && ly >= Math.min(a.y, b.y) && ly <= Math.max(a.y, b.y);
}

export function houseWorld(prop: Prop, svgX: number, svgY: number): { x: number; y: number } {
  const local = houseLocal(svgX, svgY, prop.flip === true);
  return { x: prop.x + local.x, y: prop.y + local.y };
}

export function svgXOf(prop: Prop, worldX: number): number {
  const local = (worldX - prop.x) / SCALE;
  return (prop.flip ? -local : local) + ANCHOR.x;
}

export function svgYOf(prop: Prop, worldY: number): number {
  return (worldY - prop.y) / SCALE + ANCHOR.y;
}

// Feet on the deck (past the edge) draw between the back wall and the canopy.
export function houseSlot(prop: Prop, worldX: number, worldY: number): 'out' | 'in' {
  const x = svgXOf(prop, worldX);
  const y = svgYOf(prop, worldY);
  if (y <= HOUSE_POINTS.E.y && x >= 28 && x <= 372) {
    return 'in';
  }
  return 'out';
}

// Beside or behind the cabana, the next step is the near front corner, not through the deck.
export function frontGate(prop: Prop, worldX: number, worldY: number): { x: number; y: number } | null {
  if (svgYOf(prop, worldY) >= 250) {
    return null;
  }
  const x = svgXOf(prop, worldX) < ANCHOR.x ? 8 : 392;
  return { x, y: ANCHOR.y };
}

export function houseLift(prop: Prop, worldY: number): number {
  const y = svgYOf(prop, worldY);
  let units = DECK_RISE;
  if (y >= ANCHOR.y) {
    units = 0;
  } else if (y >= HOUSE_POINTS.S.y) {
    units = (STEP_RISE * (ANCHOR.y - y)) / (ANCHOR.y - HOUSE_POINTS.S.y);
  } else if (y >= HOUSE_POINTS.E.y) {
    units = STEP_RISE + ((DECK_RISE - STEP_RISE) * (HOUSE_POINTS.S.y - y)) / (HOUSE_POINTS.S.y - HOUSE_POINTS.E.y);
  }
  return units * SCALE;
}

export function placeHouse(prop: Prop, floorBox: { xMin: number; xMax: number }): void {
  prop.w = HOUSE_WIDTH;
  prop.restMultiplier = HOUSE_REST;
  prop.flip = false;
  const left = houseLocal(ART.x0, ANCHOR.y, false).x;
  const right = houseLocal(ART.x1, ANCHOR.y, false).x;
  const minX = floorBox.xMin - left;
  const maxX = floorBox.xMax - right;
  if (minX <= maxX) {
    prop.x = Math.min(maxX, Math.max(minX, prop.x));
  }
}

export function startHouse(prop: Prop, roll: number, approach: boolean): HouseRun {
  const run: HouseRun = {
    phase: approach ? 'front' : 'in',
    propId: prop.id ?? 'dogHouse',
    flip: prop.flip === true,
    dir: roll < 0.5 ? 1 : -1,
    index: approach ? 0 : 1,
    spinSteps: spinStepsFor(roll),
    stepsDone: 0,
    turnT: 0,
    turnDur: 0.17,
    between: 'sniff',
    betweenT: 0,
    betweenDur: 0.6,
    settleT: 0,
    linger: -1,
    stretchT: 0,
    octant: 'N',
    octantFrom: 'N',
    octantBlend: 1,
    spinning: false,
    face: 1,
    holdFace: true,
    headDown: 0,
    lie: 0,
    eyes: 0,
    headRest: 0,
    stretch: 0,
    paw: 0,
    stowAfter: false,
    pending: null,
    asleepNoted: false,
    leaving: false,
    moveAfter: null,
    gate: null,
    gated: false,
  };
  look(run, 'N');
  return run;
}

export function houseInside(run: HouseRun): boolean {
  return run.phase !== 'front' && run.phase !== 'done';
}

function pointOf(prop: Prop, svg: { x: number; y: number }): { x: number; y: number } {
  return houseWorld(prop, svg.x, svg.y);
}

function poseClear(run: HouseRun): void {
  run.headDown = 0;
  run.lie = 0;
  run.eyes = 0;
  run.headRest = 0;
  run.stretch = 0;
  run.paw = 0;
  run.spinning = false;
}

function beginOut(run: HouseRun): void {
  run.phase = 'out';
  run.index = 0;
  poseClear(run);
  look(run, 'S');
}

function beginSpin(run: HouseRun): void {
  run.phase = 'spin';
  run.turnT = 0;
  run.stepsDone = 0;
  run.octantFrom = 'N';
  run.octant = ringStep('N', run.dir);
  run.octantBlend = 0;
  run.spinning = true;
  run.face = faceOf(run.octant);
  run.holdFace = true;
  run.lie = 0;
  run.headDown = 0;
  run.paw = 0;
}

export function askHouseLeave(run: HouseRun): void {
  if (run.phase === 'done' || run.phase === 'out' || run.phase === 'stretch' || run.leaving) {
    return;
  }
  run.leaving = true;
  if (run.phase === 'front') {
    run.phase = 'done';
    return;
  }
  if (run.phase === 'in') {
    const from = Math.max(0, run.index - 1);
    run.phase = 'out';
    run.index = IN_PATH.length - 1 - from;
    poseClear(run);
    look(run, 'S');
    return;
  }
  if (run.phase === 'between') {
    run.phase = 'spin';
    run.turnT = 0;
    run.paw = 0;
    run.headDown = 0;
    run.spinning = true;
    return;
  }
  if (run.phase === 'spin') {
    return;
  }
  run.phase = 'stretch';
  run.stretchT = 0;
}

export type HouseStep = {
  move: { x: number; y: number } | null;
  done: boolean;
  noteAsleep: boolean;
};

function arrive(actor: { x: number; y: number }, at: { x: number; y: number }): boolean {
  return Math.hypot(at.x - actor.x, at.y - actor.y) < 10;
}

function restPoint(prop: Prop): { x: number; y: number } {
  return pointOf(prop, HOUSE_POINTS.R);
}

export function stepHouse(
  run: HouseRun,
  prop: Prop,
  actor: { x: number; y: number },
  dt: number,
  roll: () => number,
  energyFull: boolean,
): HouseStep {
  const noteAsleep = false;
  if (run.phase === 'front') {
    look(run, 'N');
    if (!run.gated) {
      run.gate = frontGate(prop, actor.x, actor.y);
      run.gated = true;
    }
    if (run.gate) {
      const at = pointOf(prop, run.gate);
      if (!arrive(actor, at)) {
        return { move: at, done: false, noteAsleep };
      }
      run.gate = null;
    }
    const at = pointOf(prop, HOUSE_POINTS.A);
    if (arrive(actor, at)) {
      run.phase = 'in';
      run.index = 1;
    }
    return { move: at, done: false, noteAsleep };
  }
  if (run.phase === 'in') {
    const svg = IN_PATH[Math.min(run.index, IN_PATH.length - 1)] ?? HOUSE_POINTS.R;
    const at = pointOf(prop, svg);
    look(run, 'N');
    run.lie = 0;
    if (arrive(actor, at)) {
      run.index += 1;
      if (run.index >= IN_PATH.length) {
        beginSpin(run);
      }
    }
    return { move: run.phase === 'in' ? at : restPoint(prop), done: false, noteAsleep };
  }
  if (run.phase === 'spin') {
    run.holdFace = true;
    run.spinning = true;
    run.turnT += dt;
    const k = Math.min(1, run.turnT / run.turnDur);
    run.octantBlend = k;
    run.face = faceOf(run.octant);
    run.lie = 0;
    if (k >= 1) {
      run.stepsDone += 1;
      run.octantFrom = run.octant;
      run.octantBlend = 1;
      run.turnT = 0;
      run.turnDur = 0.15 + roll() * 0.05;
      const facingFront = run.octant === 'S';
      if (run.leaving) {
        if (facingFront) {
          beginOut(run);
        } else {
          run.octant = ringStep(run.octantFrom, run.dir);
          run.octantBlend = 0;
          run.face = faceOf(run.octant);
        }
      } else if (run.stepsDone >= run.spinSteps) {
        run.phase = 'settle';
        run.settleT = 0;
        run.spinning = false;
        look(run, 'S');
      } else if (run.stepsDone % 4 === 0) {
        run.phase = 'between';
        run.between = roll() < 0.5 ? 'sniff' : 'paw';
        run.betweenDur = run.between === 'sniff' ? 0.6 : 0.8;
        run.betweenT = 0;
        run.spinning = false;
        run.octantBlend = 1;
      } else {
        run.octant = ringStep(run.octantFrom, run.dir);
        run.octantBlend = 0;
        run.face = faceOf(run.octant);
      }
    }
    return { move: restPoint(prop), done: false, noteAsleep };
  }
  if (run.phase === 'between') {
    look(run, run.octant);
    run.betweenT += dt;
    run.paw = run.between === 'paw' ? 1 : 0;
    run.headDown = run.between === 'sniff' ? 0.6 : 0;
    if (run.betweenT >= run.betweenDur) {
      run.phase = 'spin';
      run.turnT = 0;
      run.paw = 0;
      run.headDown = 0;
      run.octantFrom = run.octant;
      run.octant = ringStep(run.octant, run.dir);
      run.octantBlend = 0;
      run.spinning = true;
      run.face = faceOf(run.octant);
    }
    return { move: restPoint(prop), done: false, noteAsleep };
  }
  if (run.phase === 'settle') {
    look(run, 'S');
    run.settleT += dt;
    const k = Math.min(1, run.settleT / 0.7);
    run.lie = k;
    run.headRest = k;
    run.eyes = k > 0.6 ? (k - 0.6) / 0.4 : 0;
    if (k >= 1) {
      run.phase = 'rest';
      run.asleepNoted = false;
    }
    return { move: null, done: false, noteAsleep: false };
  }
  if (run.phase === 'rest') {
    look(run, 'S');
    run.lie = 1;
    run.eyes = 1;
    run.headRest = 1;
    const first = !run.asleepNoted;
    run.asleepNoted = true;
    if (energyFull && run.linger < 0) {
      run.linger = 10 + roll() * 20;
    }
    if (run.linger >= 0) {
      run.linger -= dt;
      if (run.linger <= 0) {
        run.phase = 'stretch';
        run.stretchT = 0;
      }
    }
    return { move: null, done: false, noteAsleep: first };
  }
  if (run.phase === 'stretch') {
    look(run, 'S');
    run.stretchT += dt;
    const k = Math.min(1, run.stretchT / 0.8);
    run.lie = 1 - k;
    run.eyes = 1 - k;
    run.headRest = 1 - k;
    run.stretch = k < 0.85 ? k : 1 - (k - 0.85) / 0.15;
    if (k >= 1) {
      beginOut(run);
    }
    return { move: null, done: false, noteAsleep: false };
  }
  if (run.phase === 'out') {
    const svg = OUT_PATH[Math.min(run.index, OUT_PATH.length - 1)] ?? HOUSE_POINTS.A;
    const at = pointOf(prop, svg);
    look(run, 'S');
    if (arrive(actor, at)) {
      run.index += 1;
      if (run.index >= OUT_PATH.length) {
        run.phase = 'done';
        return { move: null, done: true, noteAsleep: false };
      }
    }
    return { move: at, done: false, noteAsleep: false };
  }
  return { move: null, done: true, noteAsleep: false };
}

export function wantsHouseRest(energy: number, roll: number): boolean {
  return energy < 0.6 && roll < 0.05;
}
