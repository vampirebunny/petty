// Octant ring, turn timings, and the shared depth curve. One place so the pet and the toy match.

export const octants = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

export type Facing = (typeof octants)[number];

// Clockwise when the camera is south: E turns toward the camera through SE.
export const facingRing = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;

export type ViewId = 'side' | 'front34' | 'front' | 'back34' | 'back';

export const facingConfig = {
  // Degrees past an octant boundary before the target octant changes.
  hysteresisDeg: 10,
  // Uneven slices, measured from horizontal. Side is inside sideDeg, diagonals run to frontDeg, N/S are beyond that.
  sectors: {
    sideDeg: 35,
    frontDeg: 72,
  },
  // Below this speed the last octant is kept. Matches the walk pose cutoff.
  restSpeed: 14,
  // How long a neighbor must be the target before the next step. Overlaps the tween.
  turnHold: 0.075,
  // Blend of foreshorten, shadow, hips, legs, and the head into the next octant.
  neighborTween: 0.08,
  // Head starts turning slightly ahead of the body, as the old lead did.
  headLead: 0.08,
  // Low-pass on the velocity that picks an octant.
  aimTau: 0.1,
  // Do not retarget the octant while braking into a point this close.
  arriveIgnore: 30,
  // A long turn keeps walking unless the goal is already this close.
  turnStop: 20,
  // Speed scale while the ring is still catching a turn of more than one octant.
  turnSpeed: 0.4,
  // How much depth (across the facing) drops the far side on screen. Forward ground motion stays 1:1 so a planted paw does not skate.
  depthTilt: 0.35,
  // Farther legs draw this much narrower. Paw size grows with normalized depth.
  legNarrow: 0.08,
  pawDepth: 0.06,
  depth: {
    enabled: true,
    min: 0.9,
    max: 1,
  },
} as const;
