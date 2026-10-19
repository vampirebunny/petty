import type { Pose } from './types';

export const poseRate: Record<keyof Pose, number> = {
  sit: 5,
  lie: 4,
  walk: 8,
  paw: 9,
  pant: 4,
  headDown: 6,
  headRest: 3,
  headTurn: 10,
  eyes: 10,
  wagAmp: 4,
  breathAmp: 4,
  breathRate: 3,
  squint: 6,
  spineArch: 4,
  crouch: 4,
  headDx: 9,
  headDy: 9,
  headRot: 8,
  earBack: 12,
  torsoShift: 5,
  snoutScale: 14,
  tailLift: 6,
  belly: 3.5,
  knead: 6,
  paddle: 5,
  kick: 12,
  shake: 14,
};

export function defaultPose(): Pose {
  return {
    sit: 0,
    lie: 0,
    walk: 0,
    paw: 0,
    pant: 0,
    headDown: 0,
    headRest: 0,
    headTurn: 0,
    eyes: 0,
    wagAmp: 0.22,
    breathAmp: 0.012,
    breathRate: 0.9,
    squint: 0,
    spineArch: 0,
    crouch: 0,
    headDx: 0,
    headDy: 0,
    headRot: 0,
    earBack: 0,
    torsoShift: 0,
    snoutScale: 1,
    tailLift: 0,
    belly: 0,
    knead: 0,
    paddle: 0,
    kick: 0,
    shake: 0,
  };
}

export function easeInOutSine(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

// A damped spring step response: 0 at t = 0, overshoots 1, then settles on 1. For the ear perk and the boop only.
export function springUp(t: number, damping = 9, freq = 22): number {
  if (t <= 0) {
    return 0;
  }
  return 1 - Math.exp(-damping * t) * Math.cos(freq * t);
}

export function easePose(pose: Pose, targets: Pose, dt: number): Pose {
  const next = { ...pose };
  (Object.keys(pose) as (keyof Pose)[]).forEach((key) => {
    const rate = poseRate[key];
    next[key] = pose[key] + (targets[key] - pose[key]) * (1 - Math.exp(-dt * rate));
  });
  return next;
}
