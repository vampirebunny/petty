import type { Prop } from './scenes';

// The art is 360×300. A literal map of 80 units onto the longest dog does not fit the
// room, so the house is a fixed 260px wide. The cushion is about one adult body.
export const HOUSE_WIDTH = 260;
export const VIEW_W = 360;
export const VIEW_H = 300;
export const ANCHOR = { x: 180, y: 268 };
export const SCALE = HOUSE_WIDTH / VIEW_W;
export const ADULT_BODY = 80;
export const HOUSE_REST = 2.5;

export const HOUSE_POINTS = {
  A: { x: 60, y: 268 },
  S1: { x: 112, y: 250 },
  S2: { x: 122, y: 238 },
  D: { x: 124, y: 229 },
  I: { x: 170, y: 230 },
  R: { x: 228, y: 232 },
} as const;

const IN_PATH = [HOUSE_POINTS.A, HOUSE_POINTS.S1, HOUSE_POINTS.S2, HOUSE_POINTS.D, HOUSE_POINTS.I, HOUSE_POINTS.R];
const OUT_PATH = [HOUSE_POINTS.I, HOUSE_POINTS.D, HOUSE_POINTS.S2, HOUSE_POINTS.S1, HOUSE_POINTS.A];

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
  into: 1 | -1;
  index: number;
  spinLeft: number;
  turnsDone: number;
  turnT: number;
  turnDur: number;
  between: 'sniff' | 'paw';
  betweenT: number;
  betweenDur: number;
  settleT: number;
  linger: number;
  stretchT: number;
  face: 1 | -1;
  holdFace: boolean;
  headTurn: number;
  lie: number;
  eyes: number;
  headRest: number;
  stretch: number;
  paw: number;
  hop: boolean;
  stowAfter: boolean;
  pending: HouseTask | null;
  asleepNoted: boolean;
  leaving: boolean;
  leaveTurn: boolean;
  moveAfter: { x: number; y: number } | null;
};

export function houseLocal(svgX: number, svgY: number, flip: boolean): { x: number; y: number } {
  const x = flip ? ANCHOR.x * 2 - svgX : svgX;
  return { x: (x - ANCHOR.x) * SCALE, y: (svgY - ANCHOR.y) * SCALE };
}

export function houseWorld(prop: Prop, svgX: number, svgY: number): { x: number; y: number } {
  const local = houseLocal(svgX, svgY, prop.flip === true);
  return { x: prop.x + local.x, y: prop.y + local.y };
}

export function svgXOf(prop: Prop, worldX: number): number {
  const local = (worldX - prop.x) / SCALE;
  const svg = (prop.flip ? -local : local) + ANCHOR.x;
  return svg;
}

// Door opening in viewBox x. Past 142 the body is inside the glass.
export function houseSlot(prop: Prop, worldX: number): 'out' | 'in' | 'cross' {
  const x = svgXOf(prop, worldX);
  if (x > 142) {
    return 'in';
  }
  if (x < 106) {
    return 'out';
  }
  return 'cross';
}

export function shouldFlipHouse(x: number, xMin: number, xMax: number): boolean {
  const leftEdge = x + houseLocal(30, 268, false).x;
  const rightEdge = x + houseLocal(342, 240, false).x;
  const left = leftEdge - xMin;
  const right = xMax - rightEdge;
  if (left >= ADULT_BODY) {
    return false;
  }
  return right > left;
}

export function placeHouse(prop: Prop, floor: { xMin: number; xMax: number }): void {
  prop.w = HOUSE_WIDTH;
  prop.restMultiplier = HOUSE_REST;
  prop.flip = shouldFlipHouse(prop.x, floor.xMin, floor.xMax);
}

export function halfTurnsFor(roll: number): 3 | 5 {
  return roll < 0.5 ? 3 : 5;
}

function doorFace(into: 1 | -1): 1 | -1 {
  return into === 1 ? -1 : 1;
}

export function faceAfterHalfTurns(into: 1 | -1, turnsDone: number): 1 | -1 {
  return turnsDone % 2 === 0 ? into : doorFace(into);
}

export function startHouse(prop: Prop, roll: number, fromRight: boolean): HouseRun {
  const flip = prop.flip === true;
  const into: 1 | -1 = flip ? -1 : 1;
  return {
    phase: fromRight ? 'front' : 'in',
    propId: prop.id ?? 'dogHouse',
    flip,
    into,
    index: 0,
    spinLeft: halfTurnsFor(roll),
    turnsDone: 0,
    turnT: 0,
    turnDur: 0.6,
    between: 'sniff',
    betweenT: 0,
    betweenDur: 0.6,
    settleT: 0,
    linger: -1,
    stretchT: 0,
    face: into,
    holdFace: true,
    headTurn: 0,
    lie: 0,
    eyes: 0,
    headRest: 0,
    stretch: 0,
    paw: 0,
    hop: false,
    stowAfter: false,
    pending: null,
    asleepNoted: false,
    leaving: false,
    leaveTurn: false,
    moveAfter: null,
  };
}

export function houseInside(run: HouseRun): boolean {
  return run.phase !== 'front' && run.phase !== 'done';
}

function pointOf(prop: Prop, svg: { x: number; y: number }): { x: number; y: number } {
  return houseWorld(prop, svg.x, svg.y);
}

function poseClear(run: HouseRun): void {
  run.headTurn = 0;
  run.lie = 0;
  run.eyes = 0;
  run.headRest = 0;
  run.stretch = 0;
  run.paw = 0;
  run.hop = false;
  run.holdFace = false;
}

function beginOut(run: HouseRun): void {
  run.phase = 'out';
  run.index = 0;
  poseClear(run);
  run.face = doorFace(run.into);
  run.holdFace = true;
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
    const map = [4, 3, 2, 1, 0, 0];
    if (run.index <= 0) {
      run.phase = 'done';
      return;
    }
    run.phase = 'out';
    run.index = map[Math.min(run.index, map.length - 1)] ?? 0;
    poseClear(run);
    run.face = doorFace(run.into);
    run.holdFace = true;
    return;
  }
  if (run.phase === 'between') {
    const facingDoor = faceAfterHalfTurns(run.into, run.turnsDone) === doorFace(run.into);
    if (facingDoor) {
      beginOut(run);
    } else {
      run.phase = 'spin';
      run.turnT = 0;
      run.leaveTurn = true;
      run.paw = 0;
      run.headRest = 0;
    }
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

export function stepHouse(
  run: HouseRun,
  prop: Prop,
  actor: { x: number; y: number },
  dt: number,
  roll: () => number,
  energyFull: boolean,
): HouseStep {
  run.hop = false;
  const noteAsleep = false;
  if (run.phase === 'front') {
    const at = pointOf(prop, HOUSE_POINTS.A);
    run.holdFace = false;
    run.face = run.into;
    if (arrive(actor, at)) {
      run.phase = 'in';
      run.index = 1;
      run.hop = true;
    }
    return { move: at, done: false, noteAsleep };
  }
  if (run.phase === 'in') {
    const svg = IN_PATH[Math.min(run.index, IN_PATH.length - 1)] ?? HOUSE_POINTS.R;
    const at = pointOf(prop, svg);
    run.holdFace = true;
    run.face = run.into;
    run.lie = 0;
    if (arrive(actor, at)) {
      run.index += 1;
      run.hop = run.index > 1 && run.index < IN_PATH.length;
      if (run.index >= IN_PATH.length) {
        run.phase = 'spin';
        run.turnT = 0;
        run.turnsDone = 0;
      }
    }
    return { move: run.phase === 'in' ? at : pointOf(prop, HOUSE_POINTS.R), done: false, noteAsleep };
  }
  if (run.phase === 'spin') {
    run.holdFace = true;
    run.turnT += dt;
    const k = Math.min(1, run.turnT / run.turnDur);
    run.headTurn = Math.sin(k * Math.PI);
    run.face = faceAfterHalfTurns(run.into, run.turnsDone);
    run.lie = 0;
    if (k >= 1) {
      run.turnsDone += 1;
      run.face = faceAfterHalfTurns(run.into, run.turnsDone);
      run.headTurn = 0;
      run.turnT = 0;
      run.turnDur = 0.5 + roll() * 0.2;
      const facingDoor = run.face === doorFace(run.into);
      if (run.leaving) {
        if (facingDoor || run.leaveTurn) {
          beginOut(run);
        } else {
          run.leaveTurn = true;
        }
      } else {
        run.spinLeft = Math.max(0, run.spinLeft - 1);
        if (run.spinLeft <= 0) {
          run.phase = 'settle';
          run.settleT = 0;
        } else if (roll() < 0.5) {
          run.phase = 'between';
          run.between = roll() < 0.5 ? 'sniff' : 'paw';
          run.betweenDur = run.between === 'sniff' ? 0.6 : 0.8;
          run.betweenT = 0;
        }
      }
    }
    return { move: pointOf(prop, HOUSE_POINTS.R), done: false, noteAsleep };
  }
  if (run.phase === 'between') {
    run.holdFace = true;
    run.face = faceAfterHalfTurns(run.into, run.turnsDone);
    run.betweenT += dt;
    run.paw = run.between === 'paw' ? 1 : 0;
    run.headRest = run.between === 'sniff' ? 0.6 : 0;
    if (run.betweenT >= run.betweenDur) {
      run.phase = 'spin';
      run.turnT = 0;
      run.paw = 0;
      run.headRest = 0;
    }
    return { move: pointOf(prop, HOUSE_POINTS.R), done: false, noteAsleep };
  }
  if (run.phase === 'settle') {
    run.holdFace = true;
    run.face = doorFace(run.into);
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
    run.holdFace = true;
    run.face = doorFace(run.into);
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
    run.holdFace = true;
    run.face = doorFace(run.into);
    run.stretchT += dt;
    const k = Math.min(1, run.stretchT / 0.8);
    run.lie = 1 - k;
    run.eyes = 1 - k;
    run.headRest = 1 - k;
    run.stretch = k < 0.85 ? k : 1 - (k - 0.85) / 0.15;
    if (k >= 1) {
      run.phase = 'out';
      run.index = 0;
      poseClear(run);
      run.face = doorFace(run.into);
    }
    return { move: null, done: false, noteAsleep: false };
  }
  if (run.phase === 'out') {
    const svg = OUT_PATH[Math.min(run.index, OUT_PATH.length - 1)] ?? HOUSE_POINTS.A;
    const at = pointOf(prop, svg);
    run.holdFace = true;
    run.face = doorFace(run.into);
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
