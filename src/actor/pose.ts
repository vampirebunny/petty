import type { Pose } from './types';

export const poseRate: Record<keyof Pose, number> = {
  sit: 5,
  lie: 4,
  walk: 8,
  paw: 9,
  pant: 4,
  headDown: 6,
  headRest: 3,
  headTurn: 7,
  eyes: 10,
  wagAmp: 4,
  breathAmp: 4,
  breathRate: 3,
  squint: 6,
  spineArch: 4,
  crouch: 4,
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
  };
}

export function easePose(pose: Pose, targets: Pose, dt: number): Pose {
  const next = { ...pose };
  (Object.keys(pose) as (keyof Pose)[]).forEach((key) => {
    const rate = poseRate[key];
    next[key] = pose[key] + (targets[key] - pose[key]) * (1 - Math.exp(-dt * rate));
  });
  return next;
}
