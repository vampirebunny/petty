import type { Vec } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function solveKnee(hip: Vec, foot: Vec, bone: number, side: number): Vec {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = clamp(Math.hypot(dx, dy), 0.5, bone * 2 - 0.01);
  const angle = Math.acos(clamp((bone * bone + d * d - bone * bone) / (2 * bone * d), -1, 1));
  const dir = Math.atan2(dy, dx) + side * angle;
  return { x: hip.x + Math.cos(dir) * bone, y: hip.y + Math.sin(dir) * bone };
}

// A trot or gallop reaches past a straight leg. Lengthen both bones so the paw stays on the
// stride. Stopping at full extension leaves the paw hanging while the step keeps going.
export function boneFor(hip: Vec, target: Vec, legLength: number): number {
  const span = Math.hypot(target.x - hip.x, target.y - hip.y);
  const reach = Math.max(legLength / 2, span / 2);
  return Math.min(reach, legLength * 0.85);
}

export function placeLeg(hip: Vec, target: Vec, legLength: number, side: number): { knee: Vec; paw: Vec } {
  const bone = boneFor(hip, target, legLength);
  const knee = solveKnee(hip, target, bone, side);
  const ex = target.x - knee.x;
  const ey = target.y - knee.y;
  const length = Math.hypot(ex, ey) || 1;
  return { knee, paw: { x: knee.x + (ex / length) * bone, y: knee.y + (ey / length) * bone } };
}

export function gaitFoot(phase: number, offset: number, stride: number, lift: number): Vec {
  const turn = Math.PI * 2;
  const u = (((phase + offset) / turn) % 1 + 1) % 1;
  const plant = 0.55;
  if (u < plant) {
    return { x: stride * (0.5 - u / plant), y: 0 };
  }
  const swing = (u - plant) / (1 - plant);
  return { x: stride * (swing - 0.5), y: -lift * Math.sin(Math.PI * swing) };
}
