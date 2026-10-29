import { breedById, geomOf, setDirection } from '../actor';
import type { Actor } from '../actor';
import { snapFacing } from '../actor/facing';
import { depthScale, PET_SIZE, stageWidth, travelGateX } from '../actor/geometry';

// Wall-clock opening, before the stored beats. The interaction after this runs at playSpeed.
export const portraitMs = 2000;
export const emptyMs = 800;
export const enterLimitMs = 8000;
export const playSpeed = 2;
export const homeA = 200;
export const homeB = 440;

export type OpeningPhase = 'portraitA' | 'portraitB' | 'empty' | 'enterA' | 'enterB' | 'play';

export type OpeningState = { phase: OpeningPhase; elapsed: number };

type Floor = { xMin: number; xMax: number; yMin: number; yMax: number };

// Timed cuts, then each walk ends when that pet arrives. A walk that never arrives is cut off.
export function stepOpening(state: OpeningState, dtMs: number, arrived: boolean): OpeningState {
  if (state.phase === 'play') {
    return state;
  }
  const elapsed = state.elapsed + dtMs;
  if (state.phase === 'portraitA' && elapsed >= portraitMs) {
    return { phase: 'portraitB', elapsed: elapsed - portraitMs };
  }
  if (state.phase === 'portraitB' && elapsed >= portraitMs) {
    return { phase: 'empty', elapsed: elapsed - portraitMs };
  }
  if (state.phase === 'empty' && elapsed >= emptyMs) {
    return { phase: 'enterA', elapsed: elapsed - emptyMs };
  }
  if (state.phase === 'enterA' && (arrived || elapsed >= enterLimitMs)) {
    return { phase: 'enterB', elapsed: 0 };
  }
  if (state.phase === 'enterB' && (arrived || elapsed >= enterLimitMs)) {
    return { phase: 'play', elapsed: 0 };
  }
  return { phase: state.phase, elapsed };
}

export function gateX(actor: Actor, floor: Floor, side: 1 | -1): number {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return side > 0 ? stageWidth + 160 : -160;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const scale = PET_SIZE * geom.sc * depthScale(actor.y, floor.yMin, floor.yMax);
  return travelGateX(geom, scale, side);
}

function still(actor: Actor): void {
  actor.vx = 0;
  actor.vy = 0;
  actor.speed = 0;
}

export function showPortrait(actor: Actor, x: number, y: number, face: 1 | -1 = 1): void {
  actor.x = x;
  actor.y = y;
  still(actor);
  actor.task.type = 'idle';
  actor.task.stage = '';
  actor.pose.sit = 1;
  actor.pose.walk = 0;
  actor.pose.faceCam = 1;
  setDirection(actor, { target: { x, y }, pace: 0, pose: 'sit', token: 0 });
  // The octant owns face. Setting face alone is overwritten before the ring can turn.
  snapFacing(actor, face);
}

// Travel keeps the sim from pulling an off-screen pet back onto the floor.
export function parkOffstage(actor: Actor, floor: Floor, side: 1 | -1, y: number): void {
  actor.y = y;
  actor.x = gateX(actor, floor, side);
  still(actor);
  actor.direction = null;
  actor.task.type = 'travel';
  actor.task.stage = 'hold';
  actor.face = side < 0 ? 1 : -1;
}

export function walkOn(actor: Actor, floor: Floor, side: 1 | -1, x: number, y: number, token: number): void {
  actor.y = y;
  actor.x = gateX(actor, floor, side);
  still(actor);
  setDirection(actor, { target: { x, y }, pace: 0.45, pose: 'walk', token });
  actor.task.type = 'travel';
  actor.task.stage = 'enter';
}

function settle(actor: Actor, x: number, y: number): void {
  actor.x = x;
  actor.y = y;
  still(actor);
  actor.direction = null;
  actor.task.type = 'sit';
  actor.task.stage = '';
  actor.task.t = 0;
}

export function closeEnough(actor: Actor, x: number, y: number): boolean {
  return Math.hypot(actor.x - x, actor.y - y) < 16 && actor.speed < 24;
}

export function placeOpening(phase: OpeningPhase, left: Actor, right: Actor, floor: Floor, y: number): void {
  if (phase === 'portraitA') {
    showPortrait(left, homeA, y, 1);
    parkOffstage(right, floor, 1, y);
    return;
  }
  if (phase === 'portraitB') {
    parkOffstage(left, floor, -1, y);
    showPortrait(right, homeB, y, -1);
    return;
  }
  if (phase === 'empty') {
    parkOffstage(left, floor, -1, y);
    parkOffstage(right, floor, 1, y);
    return;
  }
  if (phase === 'enterA') {
    walkOn(left, floor, -1, homeA, y, 1);
    parkOffstage(right, floor, 1, y);
    return;
  }
  if (phase === 'enterB') {
    settle(left, homeA, y);
    walkOn(right, floor, 1, homeB, y, 2);
    return;
  }
  settle(left, homeA, y);
  settle(right, homeB, y);
}
