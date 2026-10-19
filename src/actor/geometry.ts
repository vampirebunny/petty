import { limbSize } from './breeds';
import { growthFor, smoothstep } from './growth';
import { stageHeight, stageWidth } from './scenes';
import type { Breed, Vec } from './types';

export { stageHeight, stageWidth };
export const frameCapMs = 50;

export type Geom = {
  sc: number;
  L: number;
  bodyH: number;
  bodyLen: number;
  bodyY: number;
  hipY: number;
  headR: number;
  snout: number;
  Px: number;
  Py: number;
  foreX: number;
  hindX: number;
  aSit: number;
  dLie: number;
  tipX: number;
  tipY: number;
  legWidth: number;
  pawRx: number;
  pawRy: number;
  eye: number;
  cf: number;
  bags: number;
  thick: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function thickOf(weight: number): number {
  const value = clamp(weight, -1, 1);
  const amount = Math.abs(value) ** 1.5;
  return value >= 0 ? 1 + 0.5 * amount : 1 - 0.3 * amount;
}

export function bagAmount(ageDays: number, vitality: number): number {
  const grown = smoothstep((ageDays - 600) / 200);
  return grown * (1 - clamp(vitality, 0, 1));
}

export function geomOf(breed: Breed, ageDays: number, weight: number, vitality = 1): Geom {
  const growth = growthFor(ageDays);
  const thick = thickOf(weight);
  const cf = clamp(breed.cuteness * (0.55 + 0.45 * (1 - growth.scale)), 0, 1.2);
  const limbs = limbSize(breed.species);
  const L = breed.legLen * 70 * (0.55 + 0.45 * growth.leg);
  const bodyH0 = breed.bodyH * 50;
  const bodyH = bodyH0 * thick;
  const bodyLen = breed.bodyLen * 112 * (0.8 + 0.2 * growth.body);
  const sag = (thick - 1) * bodyH0 * 0.4;
  const bottom = Math.min(-2, -(0.93 * L - 8) + sag);
  const bodyY = bottom - bodyH / 2;
  const headR = breed.head * 22 * (1.25 - 0.25 * growth.head) * (1 + 0.28 * cf);
  const snout = breed.snout * 26 * (0.85 + 0.15 * growth.snout);
  const Px = -bodyLen / 2 + 8;
  const Py = bodyY + bodyH / 2 - 4;
  const foreX = bodyLen / 2 - 16;
  const span = foreX - Px;
  const aSit = Math.asin(clamp(span === 0 ? 0 : (0.9 * L - 4) / span, 0, 0.95));
  return {
    sc: (0.62 + 0.38 * growth.scale) * breed.size,
    L,
    bodyH,
    bodyLen,
    bodyY,
    hipY: -0.93 * L,
    headR,
    snout,
    Px,
    Py,
    foreX,
    hindX: -bodyLen / 2 + 16,
    aSit,
    dLie: -bodyH / 2 + 3 - bodyY,
    tipX: headR * 0.85 + snout * 1.15,
    tipY: headR * 0.3 + headR * 0.15,
    legWidth: limbs.legW * (1 + 0.15 * clamp(weight, -1, 1)),
    pawRx: limbs.pawRx * (1 + 0.25 * cf),
    pawRy: limbs.pawRy * (1 + 0.25 * cf),
    eye: growth.eye,
    cf,
    bags: bagAmount(ageDays, vitality),
    thick,
  };
}

export type HeadFace = {
  turn: number;
  // Distance between the eyes at t = 1.
  gap3: number;
  eyeR: number;
  nearEye: Vec;
  farEye: Vec;
  // 0..1 fade of the far eye, reaching 1 at t = 0.3.
  farEyeAlpha: number;
  farEyeScale: Vec;
  top: Vec;
  // Snout center at t, interpolated from the side-view center (sideX, sideY).
  snoutX: number;
  snoutY: number;
  snoutXScale: number;
  farEarShift: Vec;
  // Slides a floppy near ear back so it never covers the near eye in 3/4.
  nearEarShift: Vec;
  farEarAlpha: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Head layout in head space for a head turn t (0 = side view, 1 = 3/4). One source of truth for the
// renderer, glasses, hats and the published anchors.
export function headFaceOf(breed: Breed, geom: Geom, turn: number): HeadFace {
  const t = clamp(turn, 0, 1);
  const R = geom.headR;
  const cf = geom.cf;
  const f = breed.face3q;
  const eyeR = R * (0.13 + 0.07 * (1 - geom.eye) + 0.12 * cf);
  const sideX = R * (0.3 + 0.05 * cf);
  const eyeY = -R * (0.12 - 0.09 * cf);
  // The far eye keeps a minimum gap so large puppy and kitten eyes never overlap, and stays inside the head.
  const farDx = Math.max(f.farEyeDx * R, eyeR * 2.4);
  const far3 = Math.min(sideX - R * 0.1 + farDx, R * 0.76);
  const near3 = Math.min(sideX - R * 0.1, far3 - farDx);
  const farFade = Math.min(1, t / 0.3);
  const mid3 = (near3 + far3) / 2;
  // A floppy near ear hangs from (-0.15R, -0.35R) tilted back. Its right edge must clear the near eye's
  // left edge once the eye has moved to its 3/4 position, so the ear slides back by the overlap.
  const earRight = -R * 0.15 - R * 0.136 * breed.earSize + R * 0.42 * breed.earSize;
  const eyeLeft3 = near3 - eyeR * 1.12;
  // Pointy and cat ears slide back too, so the pair spreads apart instead of bunching at the top front.
  const nearEarBack = breed.ear === 'floppy' ? clamp(earRight - eyeLeft3 + R * 0.05, 0, R * 0.4) : R * 0.28;
  const sideSnoutX = R * 0.55 + geom.snout * 0.45;
  const sideSnoutY = R * 0.3;
  return {
    eyeR,
    nearEye: { x: lerp(sideX, near3, t), y: eyeY },
    farEye: { x: lerp(sideX, far3, t), y: eyeY },
    turn: t,
    gap3: far3 - near3,
    farEyeAlpha: farFade * farFade * (3 - 2 * farFade),
    farEyeScale: { x: 0.75, y: 0.9 },
    top: { x: lerp(0, R * 0.08, t), y: -R },
    snoutX: lerp(sideSnoutX, mid3 + f.snoutShift * R, t),
    snoutY: lerp(sideSnoutY, sideSnoutY + f.snoutDrop * R, t),
    snoutXScale: lerp(1, 0.55, t),
    farEarShift: { x: f.farEarDx * R * t, y: f.farEarDy * R * t },
    nearEarShift: { x: -nearEarBack * t, y: 0 },
    farEarAlpha: Math.min(1, t / 0.5),
  };
}

export function depthScale(y: number, yMin: number, yMax: number): number {
  const span = yMax - yMin;
  return 0.82 + 0.18 * clamp(span === 0 ? 0 : (y - yMin) / span, 0, 1);
}

export function speedMax(breed: Breed, ageDays: number, weight = 0): number {
  const growth = growthFor(ageDays).scale;
  const heavy = 1 - 0.22 * Math.max(0, clamp(weight, -1, 1));
  return 175 * (0.7 + 0.3 * growth) * (0.65 + 0.35 * Math.min(breed.legLen, 1)) * heavy;
}

export function reachOf(geom: Geom): number {
  return geom.bodyLen / 2 + 4 + geom.tipX * 0.9;
}

export function torsoPoint(geom: Geom, theta: number, dy: number, x: number, y: number): Vec {
  const rx = x - geom.Px;
  const ry = y - geom.Py;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: geom.Px + rx * c - ry * s, y: geom.Py + rx * s + ry * c + dy };
}

export type BodyFrame = {
  geom: Geom;
  scale: number;
  theta: number;
  dy: number;
  mouth: Vec;
  head: Vec;
  pitch: number;
};

export function bodyFrame(
  breed: Breed,
  ageDays: number,
  weight: number,
  vitality: number,
  pose: {
    sit: number;
    lie: number;
    walk: number;
    headDown: number;
    headRest: number;
    pant: number;
  },
  barkOpen: number,
  phase: number,
  x: number,
  y: number,
  face: number,
  floor: { yMin: number; yMax: number },
  speed = 0,
): BodyFrame {
  const geom = geomOf(breed, ageDays, weight, vitality);
  const scale = geom.sc * depthScale(y, floor.yMin, floor.yMax);
  const theta = -geom.aSit * pose.sit + 0.12 * pose.headDown;
  const bounce =
    -Math.abs(Math.sin(phase)) * 2.4 * pose.walk * (0.5 + clamp(speed / 190, 0, 1) * 0.8) - barkOpen * 2.5;
  const dy = -geom.Py * pose.sit + geom.dLie * pose.lie + bounce;
  const natural = torsoPoint(geom, theta, dy, geom.bodyLen / 2 + 4, geom.bodyY - geom.bodyH * 0.32 - 4);
  natural.x += 10 * pose.sit;
  natural.y += Math.sin(phase * 2) * 1.4 * pose.walk;
  const pitchBase = -0.1 * pose.sit - 0.3 * barkOpen;
  const eatPitch = 0.7;
  const restPitch = 0.12;
  const headFor = (mx: number, my: number, pitch: number): Vec => {
    const cs = Math.cos(pitch);
    const sn = Math.sin(pitch);
    return {
      x: mx - (geom.tipX * cs - geom.tipY * sn),
      y: my - (geom.tipX * sn + geom.tipY * cs),
    };
  };
  const eat = headFor(geom.bodyLen / 2 + 34, -10, eatPitch);
  const rest = headFor(geom.foreX + 0.97 * geom.L - 6, -7, restPitch);
  const head = {
    x: natural.x + (eat.x - natural.x) * pose.headDown + (rest.x - natural.x) * pose.headRest,
    y: natural.y + (eat.y - natural.y) * pose.headDown + (rest.y - natural.y) * pose.headRest,
  };
  const pitch = pitchBase + (eatPitch - pitchBase) * pose.headDown + (restPitch - pitchBase) * pose.headRest;
  const cs = Math.cos(pitch);
  const sn = Math.sin(pitch);
  const local = {
    x: head.x + geom.tipX * cs - geom.tipY * sn,
    y: head.y + geom.tipX * sn + geom.tipY * cs,
  };
  return {
    geom,
    scale,
    theta,
    dy,
    pitch,
    head,
    mouth: { x: x + face * scale * local.x, y: y + scale * local.y },
  };
}
