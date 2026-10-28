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
