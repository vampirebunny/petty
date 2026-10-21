import type { Actor } from './types';

export const TURN_DUR = 0.4;
export const FLIP_V = 40;
export const FLIP_T = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function baseYaw(face: number): number {
  return face >= 0 ? 0 : Math.PI;
}

export function yawTarget(face: number, faceCam: number): number {
  const cam = clamp(faceCam, 0, 1);
  const shift = (face >= 0 ? 1 : -1) * cam * (Math.PI / 2 - 0.3);
  return clamp(baseYaw(face) + shift, 0, Math.PI);
}

export function visualYaw(yaw: number): { dir: 1 | -1; yc: number; ys: number } {
  const dir: 1 | -1 = Math.cos(yaw) >= 0 ? 1 : -1;
  return { dir, yc: Math.abs(Math.cos(yaw)), ys: Math.max(0, Math.sin(yaw)) };
}

// Free movement only. A greeting owns facing and skips this.
export function stepFacing(actor: Actor, dt: number, ownsFacing: boolean): void {
  if (ownsFacing) {
    actor.faceHold = 0;
    return;
  }
  const eating = actor.task.type === 'eat' && actor.task.stage === 'eating';
  if (eating) {
    actor.faceHold = 0;
    return;
  }
  const against = actor.vx * actor.face < 0 && Math.abs(actor.vx) > FLIP_V;
  actor.faceHold = against ? actor.faceHold + dt : 0;
  if (actor.faceHold >= FLIP_T) {
    actor.face = actor.vx > 0 ? 1 : -1;
    actor.faceHold = 0;
  }
}

export function stepYaw(actor: Actor, dt: number, _faceCam: number): void {
  if (actor.lead > 0 && !actor.spin) {
    actor.lead = Math.max(0, actor.lead - dt);
  }
  // Body facing is the octant ring. Yaw only still eases a greeting spin.
  if (!actor.spin) {
    actor.yaw = baseYaw(actor.face);
    actor.yawFace = actor.face >= 0 ? 1 : -1;
    return;
  }
  const target = baseYaw(actor.face);
  const rate = actor.spin.rate;
  const delta = target - actor.yaw;
  const step = Math.min(Math.abs(delta), rate * dt);
  actor.yaw = clamp(actor.yaw + Math.sign(delta || 1) * step, 0, Math.PI);
  if (!actor.spin.returned && Math.abs(actor.yaw - actor.spin.far) < 0.08) {
    actor.face = actor.spin.home;
    actor.yawFace = actor.spin.home;
    actor.octant = actor.spin.home >= 0 ? 'E' : 'W';
    actor.octantFrom = actor.octant;
    actor.octantTarget = actor.octant;
    actor.octantBlend = 1;
    actor.spin.returned = true;
  }
  if (actor.spin.returned && Math.abs(actor.yaw - baseYaw(actor.face)) < 0.08) {
    actor.spin = null;
  }
  actor.turning = actor.spin != null || actor.lead > 0 || actor.turning;
}

export function reversingTurn(actor: Actor): boolean {
  return actor.octantSpan > 1 && actor.octant !== actor.octantTarget && actor.spin == null;
}
