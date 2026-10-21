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
  tuck: 14,
  land: 18,
  bow: 9,
  stalk: 5,
  wiggle: 10,
  stream: 6,
  stretch: 8,
  skid: 10,
  side: 4,
  rearUp: 8,
  headUp: 6,
  headPush: 12,
  jawHold: 8,
  pupils: 8,
  closeUp: 4,
  rubSway: 6,
  legPedal: 6,
  faceCam: 6,
  headFront: 6,
  faceFront: 14,
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
    tuck: 0,
    land: 0,
    bow: 0,
    stalk: 0,
    wiggle: 0,
    stream: 0,
    stretch: 0,
    skid: 0,
    side: 0,
    rearUp: 0,
    headUp: 0,
    headPush: 0,
    jawHold: 0,
    pupils: 0,
    closeUp: 0,
    rubSway: 0,
    legPedal: 0,
    faceCam: 0,
    headFront: 0,
    faceFront: 0,
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

// `slow` below 1 makes the sit, lie and stand transitions slower (a late senior lies down and stands up slowly).
export function easePose(
  pose: Pose,
  targets: Pose,
  dt: number,
  slow = 1,
  rates?: Partial<Record<keyof Pose, number>>,
): Pose {
  const next = { ...pose };
  (Object.keys(pose) as (keyof Pose)[]).forEach((key) => {
    const rate = (rates?.[key] ?? poseRate[key]) * (key === 'sit' || key === 'lie' ? slow : 1);
    next[key] = pose[key] + (targets[key] - pose[key]) * (1 - Math.exp(-dt * rate));
  });
  return next;
}
