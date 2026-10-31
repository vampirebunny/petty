// Runway strut for The Catwalk.
//
// The strut is a walk style, not a speed band, so it is NOT added to gaitOrder and chooseGait never picks it.
// The runway forces it: the actor keeps gait 'walk' in GaitState, and the runway passes `strutDef` wherever
// gaitDefs[gait] is read for the foot path, bounce and phase rate (gaitFootFor, bounceOf, phaseRate).
// All lengths are multiples of leg length L, like gaitDefs.

import type { GaitDef } from './locomotion';
import type { Pose } from '../types';

export const strutDef: GaitDef = {
  enter: 0,
  // Longer than the everyday walk (0.38) so each step reads from across the stage.
  stride: 0.62,
  // A little less time on the ground than the walk (0.70), so paws spend longer in the air.
  duty: 0.6,
  // Same four-beat order as the walk: LH, LF, RH, RF.
  offsets: [0, 0.25, 0.5, 0.75],
  // Back paw lift. Front paws use `strutForeLift` below.
  lift: 0.24,
  // A proud bob, about 2.5x the walk.
  bounce: 2.5,
  stretch: 0,
  stream: 0,
  flightAt: 0,
};

// Front paws step higher than the hind ones.
export const strutForeLift = 0.36;

// Front paws reach forward early in the swing and settle back onto the landing spot (a prance).
// Use in place of the linear `swing` for fore legs inside gaitFootFor when the strut is active.
export function strutForeSwing(swing: number): number {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(swing - 1, 3) + c1 * Math.pow(swing - 1, 2);
}

// Foot path for the strut. Same shape as gaitFootFor, with the prance and a slightly fuller lift arc.
export function strutFoot(leg: 0 | 1 | 2 | 3, phase: number, L: number): { x: number; y: number } {
  const turn = Math.PI * 2;
  const fore = leg === 1 || leg === 3;
  const stride = L * strutDef.stride;
  const u = ((((phase + strutDef.offsets[leg] * turn) / turn) % 1) + 1) % 1;
  if (u < strutDef.duty) {
    return { x: stride * (0.5 - u / strutDef.duty), y: 0 };
  }
  const swing = (u - strutDef.duty) / (1 - strutDef.duty);
  const xs = fore ? strutForeSwing(swing) : swing;
  const lift = L * (fore ? strutForeLift : strutDef.lift);
  return { x: stride * (xs - 0.5), y: -lift * Math.pow(Math.sin(Math.PI * swing), 0.85) };
}

// Pose targets while strutting (eased with easePose like any other pose).
export const strutPose: Partial<Pose> = {
  walk: 1,
  // Chin up and tail high.
  headUp: 0.6,
  tailLift: 0.8,
  wagAmp: 0.22,
  // Chest lifted: a small constant nose-up pitch on the torso (the mock uses about 2 degrees).
  spineArch: 0.15,
};

// The optional pose at the far end of the runway: face the audience, faster wag.
export const runwayPose: Partial<Pose> = {
  walk: 0,
  faceCam: 1,
  headUp: 0.4,
  tailLift: 0.9,
  wagAmp: 0.45,
};

// Runway sequence for each of the 3 looks. Seconds. The pet's ground speed during the walk steps is constant
// and the venue scrolls at exactly that speed, so planted paws stay put.
export const runwaySteps = [
  { id: 'enter', seconds: 4.0 }, // off-screen left to center, venue still
  { id: 'walkOut', seconds: 3.0 }, // walk in place at center, venue scrolls right to left
  { id: 'stop', seconds: 0.6 }, // speed eases to 0, legs settle under the hips
  { id: 'pose', seconds: 1.3 }, // optional: runwayPose, then back
  { id: 'turn', seconds: 0.8 }, // turn through the front view (octant blend), no flat flip
  { id: 'walkBack', seconds: 3.0 }, // speed eases up over 0.5 s, venue scrolls left to right
  { id: 'exit', seconds: 4.2 }, // venue still, pet walks from center off-screen left
] as const;

export type RunwayStepId = (typeof runwaySteps)[number]['id'];

// Ground speed during the strut, as a share of the scene's walking speed. The mock uses 72 stage px/s at a
// 1.18 zoom, which is about one full stride cycle per second: slower and more deliberate than a normal walk.
export const strutCadenceHz = 1;
