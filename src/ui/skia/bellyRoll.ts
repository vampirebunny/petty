import { petStyle } from '../../actor/data/petStyle';

// Below this the cosine is held so a counter-scale that restores body thickness stays finite.
export const BELLY_AXIS_MIN = 0.045;

export type BellyRoll = {
  /** cos(theta). +1 on its side, 0 edge-on, -1 belly-up. */
  squash: number;
  /** Visible body height divided by the side-view height. Stays in [girth, 1]. */
  sil: number;
  /** 0 side-on, 1 fully edge-on. */
  bulk: number;
  /** Side-view markings. Drops out while the torso is edge-on so the flip stays hidden. */
  detail: number;
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// A belly roll is a half-turn about the spine. Scaling the flat profile by cos(theta)
// passes through 0 and the torso becomes a line. The cross-section has height and a
// lateral girth, so the silhouette is hypot(cos, girth * sin) and never thinner than girth.
export function bellyRollOf(belly: number, girth = petStyle.roll.girth): BellyRoll {
  const t = Math.max(0, Math.min(1, belly));
  const theta = t * Math.PI;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const side = Math.abs(cos);
  return {
    squash: cos,
    sil: Math.hypot(cos, girth * sin),
    bulk: Math.abs(sin),
    detail: smoothstep(0.18, 0.62, side),
  };
}

// Signed cosine, kept off zero. Legs and the tail follow this so they pass through
// the turn instead of mirroring in one frame.
export function bellyAxisScale(roll: BellyRoll): number {
  if (Math.abs(roll.squash) >= BELLY_AXIS_MIN) {
    return roll.squash;
  }
  return (roll.squash < 0 ? -1 : 1) * BELLY_AXIS_MIN;
}
