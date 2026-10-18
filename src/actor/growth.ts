import { visualLifespanDays } from '../sim/config';

export function visualProgress(ageDays: number): number {
  return Math.min(1, Math.max(0, ageDays / visualLifespanDays));
}

export function easeOut(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) * (1 - u);
}

export function smoothstep(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

export type Growth = {
  scale: number;
  body: number;
  head: number;
  snout: number;
  eye: number;
  leg: number;
};

export function growthFor(ageDays: number): Growth {
  const t = visualProgress(ageDays);
  const eased = easeOut(t);
  return {
    scale: eased,
    body: eased,
    head: eased,
    snout: eased,
    eye: eased,
    leg: smoothstep(t),
  };
}
