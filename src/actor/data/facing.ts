// Octant ring, turn timings, and the shared depth curve. One place so the pet and the toy match.

export const octants = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

export type Facing = (typeof octants)[number];

// Clockwise when the camera is south: E turns toward the camera through SE.
export const facingRing = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;

export type ViewId = 'side' | 'front34' | 'front' | 'back34' | 'back';

export const facingConfig = {
  // Degrees past an octant boundary before the target octant changes.
  hysteresisDeg: 10,
  // Below this speed the last octant is kept. Matches the walk pose cutoff.
  restSpeed: 14,
  // How long a neighbor must be the target before the next step. Overlaps the tween.
  turnHold: 0.075,
  // Blend of foreshorten, shadow, hips, legs, and the head into the next octant.
  neighborTween: 0.08,
  // Head starts turning slightly ahead of the body, as the old lead did.
  headLead: 0.08,
  depth: {
    enabled: true,
    min: 0.9,
    max: 1,
  },
} as const;
