import { bagSpanDays, bagStartDay } from '../sim/config';
import { limbSize } from './breeds';
import { earProfiles } from './data/breedShapes';
import { facingConfig } from './data/facing';
import { grayAmountsOf } from './data/graying';
import { petStyle } from './data/petStyle';
import type { GrayAmounts } from './data/graying';
import { growthFor, smoothstep, visualProgress } from './growth';
import { stageHeight, stageWidth } from './scenes';
import { racePoses, gaitDefs } from './data/locomotion';
import { blendedGait, bounceOf } from './locomotion';
import type { Breed, GaitState, Pose, Vec } from './types';

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
  // Ear size multiplier: the breed's earSize with growth and cuteness applied.
  ear: number;
  // 0..1: erect ears start folded at the puppy stage and are fully up by the adult stage.
  earRise: number;
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
  // Senior graying by region, from age only.
  gray: GrayAmounts;
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

// Share of the visual lifespan by which erect ears are fully up.
export const earRiseEnd = 0.5;

export function bagAmount(ageDays: number, vitality: number): number {
  const grown = smoothstep((ageDays - bagStartDay) / bagSpanDays);
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
  // Cuteness is a multiplier on each breed's own proportions, never a pull toward a shared shape,
  // so the order of breeds by head, snout and ear size is the same at any cuteness.
  const headScale = 1 + 0.28 * cf;
  const snoutScale = 1 - 0.14 * cf;
  const earScale = 1 + 0.12 * cf;
  const headR = breed.head * 22 * (1.25 - 0.25 * growth.head) * headScale;
  const snout = breed.snout * 26 * (0.85 + 0.15 * growth.snout) * snoutScale;
  const ear = breed.earSize * (0.85 + 0.15 * growth.head) * earScale;
  const earRise = earProfiles[breed.earType].rises ? smoothstep(visualProgress(ageDays) / earRiseEnd) : 1;
  const Px = -bodyLen / 2 + 8;
  const Py = bodyY + bodyH / 2 - 4;
  const foreX = bodyLen / 2 - 16;
  const span = foreX - Px;
  const aSit = Math.asin(clamp(span === 0 ? 0 : (0.9 * L - 4) / span, 0, 0.95));
  // A newborn draws at 0.62 of full scale. Legs and body length keep growing after that,
  // so full scale stops at 1.19× the newborn and a grown pet stays within 1.5× its baby size.
  const newbornScale = 0.62;
  const grownScale = newbornScale * 1.19;
  const geom: Geom = {
    sc: (newbornScale + (grownScale - newbornScale) * growth.scale) * breed.size,
    L,
    bodyH,
    bodyLen,
    bodyY,
    hipY: -0.93 * L,
    headR,
    snout,
    ear,
    earRise,
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
    gray: grayAmountsOf(breed.species, ageDays),
    thick,
  };
  return applyProportions(geom);
}

// Chibi multipliers, after breed, age and weight are already combined. Derived leg and body
// values are rebuilt from the new lengths so the feet, hips and lie drop stay consistent.
function applyProportions(geom: Geom): Geom {
  const p = petStyle.proportions;
  if (!p.enabled) {
    return geom;
  }
  const L = geom.L * p.legLength;
  const bodyH = geom.bodyH * p.bodyH;
  const bodyLen = geom.bodyLen * p.bodyLen;
  const headR = geom.headR * p.headR;
  const bodyH0 = geom.bodyH / geom.thick;
  const sag = (geom.thick - 1) * bodyH0 * 0.4;
  const bottom = Math.min(-2, -(0.93 * L - 8) + sag);
  const bodyY = bottom - bodyH / 2;
  const Px = -bodyLen / 2 + 8;
  const Py = bodyY + bodyH / 2 - 4;
  const foreX = bodyLen / 2 - 16;
  const span = foreX - Px;
  return {
    ...geom,
    L,
    bodyH,
    bodyLen,
    bodyY,
    hipY: -0.93 * L,
    headR,
    Px,
    Py,
    foreX,
    hindX: -bodyLen / 2 + 16,
    aSit: Math.asin(clamp(span === 0 ? 0 : (0.9 * L - 4) / span, 0, 0.95)),
    dLie: -bodyH / 2 + 3 - bodyY,
    tipX: headR * 0.85 + geom.snout * 1.15,
    tipY: headR * 0.3 + headR * 0.15,
    legWidth: geom.legWidth * p.legWidth,
    pawRx: geom.pawRx * p.paw,
    pawRy: geom.pawRy * p.paw,
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
  // Muzzle oval at t, interpolated from its side-view shape to the breed's 3/4 shape.
  muzzle: { x: number; y: number; rx: number; ry: number };
  // A square muzzle is drawn as a rounded box (Maine Coon).
  squareMuzzle: boolean;
  // Nose size multiplier from the breed.
  noseSize: number;
  farEarShift: Vec;
  // Slides a near ear back in 3/4 so it never covers the near eye and the pair spreads apart.
  nearEarShift: Vec;
  farEarAlpha: number;
  // 0 = the turn above, 1 = a symmetric face aimed at the camera.
  front: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const eyeShapeScale = { almond: 0.92, slanted: 0.92, round: 1, bigRound: 1.2 } as const;

// Head layout in head space for a head turn t (0 = side view, 1 = 3/4). `front` blends that layout
// toward a symmetric face aimed at the camera. One source of truth for the renderer, glasses, hats,
// cuddle and the published anchors. Everything breed specific comes from breed data.
export function headFaceOf(breed: Breed, geom: Geom, turn: number, front = 0): HeadFace {
  const posed = headLayout(breed, geom, turn);
  const f = clamp(front, 0, 1);
  if (f <= 0) {
    return posed;
  }
  const at = headLayout(breed, geom, 1);
  const R = geom.headR;
  const gap = Math.max(at.farEye.x - at.nearEye.x, at.eyeR * 2.4);
  const spread = Math.max(R * 0.22, Math.abs(at.nearEarShift.x), Math.abs(at.farEarShift.x));
  const tucked = earProfiles[breed.earType].stiff || breed.earType === 'folded';
  const aimed: HeadFace = {
    ...at,
    front: 1,
    nearEye: { x: -gap / 2, y: at.nearEye.y },
    farEye: { x: gap / 2, y: at.farEye.y },
    farEyeAlpha: 1,
    farEyeScale: { x: 1, y: 1 },
    top: { x: 0, y: -R },
    muzzle: { x: 0, y: at.muzzle.y, rx: Math.max(at.muzzle.rx, gap * 0.46), ry: at.muzzle.ry },
    farEarAlpha: 1,
    nearEarShift: { x: -spread, y: at.nearEarShift.y },
    // The far ear is drawn an extra 0.35R toward the back, so the shift cancels that at full front.
    farEarShift: { x: spread + (tucked ? R * 0.35 : 0), y: at.farEarShift.y },
    gap3: gap,
  };
  return {
    ...aimed,
    turn: lerp(posed.turn, aimed.turn, f),
    front: f,
    eyeR: aimed.eyeR,
    nearEye: { x: lerp(posed.nearEye.x, aimed.nearEye.x, f), y: lerp(posed.nearEye.y, aimed.nearEye.y, f) },
    farEye: { x: lerp(posed.farEye.x, aimed.farEye.x, f), y: lerp(posed.farEye.y, aimed.farEye.y, f) },
    farEyeAlpha: lerp(posed.farEyeAlpha, 1, f),
    farEyeScale: { x: lerp(posed.farEyeScale.x, 1, f), y: lerp(posed.farEyeScale.y, 1, f) },
    top: { x: lerp(posed.top.x, 0, f), y: posed.top.y },
    muzzle: {
      x: lerp(posed.muzzle.x, 0, f),
      y: lerp(posed.muzzle.y, aimed.muzzle.y, f),
      rx: lerp(posed.muzzle.rx, aimed.muzzle.rx, f),
      ry: lerp(posed.muzzle.ry, aimed.muzzle.ry, f),
    },
    farEarShift: { x: lerp(posed.farEarShift.x, aimed.farEarShift.x, f), y: lerp(posed.farEarShift.y, aimed.farEarShift.y, f) },
    nearEarShift: { x: lerp(posed.nearEarShift.x, aimed.nearEarShift.x, f), y: lerp(posed.nearEarShift.y, aimed.nearEarShift.y, f) },
    farEarAlpha: lerp(posed.farEarAlpha, 1, f),
    gap3: lerp(posed.gap3, gap, f),
  };
}

function headLayout(breed: Breed, geom: Geom, turn: number): HeadFace {
  const t = clamp(turn, 0, 1);
  const R = geom.headR;
  const cf = geom.cf;
  const cat = breed.species === 'cat';
  const profile = earProfiles[breed.earType];
  const eyeR = R * (0.13 + 0.07 * (1 - geom.eye) + 0.12 * cf) * eyeShapeScale[breed.eyeShape] * (breed.eyeSize ?? 1);
  const sideX = R * (0.3 + 0.05 * cf);
  const eyeY = -R * (0.12 - 0.09 * cf);
  // The far eye keeps a minimum gap so large puppy and kitten eyes never overlap, and stays inside the head.
  // Eye spacing is the breed's: close-set husky, wide-set pug.
  const farDx = Math.max(0.48 * breed.eyeSpacing * R, eyeR * 2.4);
  const far3 = Math.min(sideX - R * 0.1 + farDx, R * 0.78);
  const near3 = Math.min(sideX - R * 0.1, far3 - farDx);
  const farFade = Math.min(1, t / 0.3);
  const mid3 = (near3 + far3) / 2;
  // A hanging near ear drops from (-0.15R, -0.35R) tilted back. Its right edge must clear the near eye's
  // left edge once the eye has moved to its 3/4 position, so the ear slides back by the overlap.
  const earRight = -R * 0.15 - R * 0.136 * geom.ear + R * 0.42 * geom.ear;
  const eyeLeft3 = near3 - eyeR * 1.12;
  const hangBack = clamp(earRight - eyeLeft3 + R * 0.05, 0, R * 0.4);
  const nearEarBack = profile.stiff ? profile.nearBack * R : Math.max(hangBack, profile.nearBack * R);

  // Side view muzzle.
  const sideRx = cat ? geom.snout * 0.6 + R * 0.34 : geom.snout * 0.7 + R * 0.3;
  const sideRy = (cat ? R * 0.38 : R * 0.45) * (0.6 + 0.4 * breed.muzzleWidth);
  const flat = breed.skull === 'flat';
  const square = breed.skull === 'square';
  // A flat face (Persian) puts the nose right in front of the eye, level with it, in side view.
  const sideX0 = flat ? sideX + R * 0.48 - sideRx * 0.9 : R * 0.55 + geom.snout * 0.45;
  const sideY0 = flat ? eyeY + R * 0.34 : R * 0.3;
  // 3/4 muzzle: only visibleLen of the snout shows. The snout points toward the viewer and to the side the
  // head faces, so it sits off the eye midline on that side, a long one poking out past the near cheek line
  // (the head circle's edge), a short or flat one staying inside the face right under the eyes.
  const visibleLen = geom.snout * 0.7;
  const rx3 = (Math.max(R * 0.3, R * (cat ? 0.5 : 0.5) * breed.muzzleWidth) + (flat ? 0 : visibleLen * 0.36)) * (square ? 1.15 : 1);
  const ry3 = R * 0.3 * (0.6 + 0.4 * breed.muzzleWidth) * (square ? 1.2 : 1) + visibleLen * 0.14;
  const x3 = flat ? mid3 : mid3 + visibleLen * 0.3;
  // Flat faces keep the nose just under the eye line, between the eyes.
  const y3 = flat ? eyeY + R * 0.3 : eyeY + R * (0.36 + 0.1 * breed.stop) + visibleLen * 0.3;
  return {
    eyeR,
    nearEye: { x: lerp(sideX, near3, t), y: eyeY },
    farEye: { x: lerp(sideX, far3, t), y: eyeY },
    turn: t,
    gap3: far3 - near3,
    farEyeAlpha: farFade * farFade * (3 - 2 * farFade),
    farEyeScale: { x: 0.75, y: 0.9 },
    top: { x: lerp(0, R * 0.08, t), y: -R },
    muzzle: {
      x: lerp(sideX0, x3, t),
      y: lerp(sideY0, y3, t),
      rx: lerp(sideRx, rx3, t),
      ry: lerp(sideRy, ry3, t),
    },
    squareMuzzle: square,
    noseSize: breed.noseSize,
    farEarShift: { x: profile.farDx * R * t, y: (profile.farDy * t + profile.drop) * R },
    nearEarShift: { x: -nearEarBack * t, y: profile.drop * R },
    farEarAlpha: Math.min(1, t / 0.5),
    front: 0,
  };
}

// The nose center in head space. Front of the muzzle in side view, top-front of it in 3/4.
export function noseOf(breed: Breed, R: number, face: HeadFace, ryScale = 1): Vec {
  const cat = breed.species === 'cat';
  const { x, y, rx, ry } = face.muzzle;
  const t = face.turn;
  const side = {
    x: x + rx * (cat ? 0.85 : 0.9) * (1 - t) + rx * (breed.skull === 'flat' ? 0.1 : 0.5) * t,
    y: y - (cat ? R * 0.1 : R * 0.12) * (1 - t) - ry * ryScale * 0.15 * t,
  };
  const f = face.front;
  if (f <= 0) {
    return side;
  }
  return {
    x: lerp(side.x, x, f),
    y: lerp(side.y, y - ry * ryScale * (breed.skull === 'flat' ? 0.05 : 0.32), f),
  };
}

// Where Cuddle moves the head, in actor space: the pose's own lean plus a drop toward the floor as the pet rolls on its back.
export function headShift(geom: Geom, headY: number, pose: { headDx: number; headDy: number; belly: number }): Vec {
  return { x: pose.headDx, y: pose.headDy + pose.belly * (-geom.headR * 0.9 - headY) };
}

// Overall pet size multiplier, applied to everything that derives from the body frame (drawing, reach, cuddle zones).
export const PET_SIZE = 1.5;

export function depthScale(y: number, yMin: number, yMax: number): number {
  const { enabled, min, max } = facingConfig.depth;
  if (!enabled) {
    return 1;
  }
  const span = yMax - yMin;
  const t = clamp(span === 0 ? 0 : (y - yMin) / span, 0, 1);
  return min + (max - min) * t;
}

export function speedMax(breed: Breed, ageDays: number, weight = 0): number {
  const growth = growthFor(ageDays).scale;
  const heavy = 1 - 0.22 * Math.max(0, clamp(weight, -1, 1));
  return 175 * (0.7 + 0.3 * growth) * (0.65 + 0.35 * Math.min(breed.legLen, 1)) * heavy;
}

export function reachOf(geom: Geom): number {
  return geom.bodyLen / 2 + 4 + geom.tipX * 0.9;
}

// How far the tail sticks out behind the body anchor, before scale.
export function rearOf(geom: Geom): number {
  return geom.bodyLen / 2 + 50;
}

const stageEdge = 6;

// The x range an actor's anchor can take so none of the drawn pet crosses the stage edge: the floor's own
// limits, tightened by how far the head reaches in front and the tail behind at the pet's current size.
export function xRangeOf(floor: { xMin: number; xMax: number }, geom: Geom, scale: number): { lo: number; hi: number } {
  const lo = Math.max(floor.xMin, stageEdge + rearOf(geom) * scale);
  const hi = Math.min(floor.xMax, stageWidth - stageEdge - reachOf(geom) * scale);
  // A pet too big for the stage sits in the middle rather than inverting the range.
  return lo <= hi ? { lo, hi } : { lo: (lo + hi) / 2, hi: (lo + hi) / 2 };
}

// Anchor just past the stage so the whole drawn pet is off-screen. Right for an exit, left for an entrance.
export function travelGateX(geom: Geom, scale: number, side: 1 | -1): number {
  const pad = 36;
  return side > 0 ? stageWidth + reachOf(geom) * scale + pad : -(rearOf(geom) * scale + pad);
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

export type FacingFit = { foreshorten: number; front: number; rear: number; headTurn: number };

// Head-space point a carried toy sits on. Side view keeps the profile tip. A turned face
// holds the toy in the middle of the muzzle: the nose tip is the near corner of the snout,
// and a ball there hangs off the cheek. From behind, the point pulls onto the head.
export function carriedMouth(breed: Breed, geom: Geom, face: HeadFace, rear: number, snoutScale = 1): Vec {
  const nose = noseOf(breed, geom.headR, face, snoutScale);
  const turned = Math.max(face.turn, face.front);
  // Under the nose, in the mouth. Centering on the nose leaves the ball covering it.
  const faceY = nose.y + geom.headR * 0.42;
  let x = geom.tipX + (face.muzzle.x - geom.tipX) * turned;
  let y = geom.tipY + (faceY - geom.tipY) * turned;
  const back = clamp(rear, 0, 1);
  const lateral = back <= 0 ? 1 : Math.max(0, 1 - back / 0.55);
  x *= lateral;
  if (back > 0) {
    y = y + (geom.headR * 0.25 - y) * back;
  }
  return { x, y };
}

// Side keeps the head forward. 3/4 is about 55% of that reach. Front and back sit on the chest.
function headReach(foreshorten: number): number {
  const f = Math.max(0, Math.min(1, foreshorten));
  if (f >= 0.6) {
    return 0.55 + 0.45 * ((f - 0.6) / 0.4);
  }
  return (0.55 * Math.max(0, f - 0.36)) / 0.24;
}

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
  } & Partial<Pose>,
  barkOpen: number,
  phase: number,
  x: number,
  y: number,
  face: number,
  floor: { yMin: number; yMax: number },
  speed = 0,
  gait?: GaitState,
  share = 0,
  facing?: FacingFit,
): BodyFrame {
  const geom = geomOf(breed, ageDays, weight, vitality);
  const scale = PET_SIZE * geom.sc * depthScale(y, floor.yMin, floor.yMax);
  // Spine flex at canter and gallop, a play bow (chest down, rump up), a stalking crouch, and a hard skid
  // (weight back) all tilt the torso about the hind legs.
  const flightAt = gait ? blendedGait(gait, (name) => gaitDefs[name].flightAt) : 0;
  const spineAmp = breed.species === 'cat' ? racePoses.spineAmp.cat : racePoses.spineAmp.dog;
  const theta =
    -geom.aSit * pose.sit +
    0.12 * pose.headDown +
    spineAmp * (pose.stretch ?? 0) * Math.sin(phase + Math.PI / 2 - Math.PI * 2 * flightAt) +
    0.34 * (pose.bow ?? 0) +
    0.1 * (pose.stalk ?? 0) -
    0.16 * (pose.skid ?? 0);
  const stride = gait
    ? bounceOf(gait, phase, share) * pose.walk
    : -Math.abs(Math.sin(phase)) * 2.4 * pose.walk * (0.5 + clamp(speed / 190, 0, 1) * 0.8);
  const bounce = stride - barkOpen * 2.5;
  // The body drops for a stalking crouch, a play bow and a landing absorb.
  const dy =
    -geom.Py * pose.sit + geom.dLie * (pose.lie + 0.65 * (pose.stalk ?? 0) + 0.25 * (pose.bow ?? 0) + 0.5 * (pose.land ?? 0)) + bounce;
  // Resting head. With chibi proportions the neck shortens by sliding this point toward the
  // neck base (bodyLen / 2 - 14), which is the same point the neck stroke and collar use.
  const neckX = geom.bodyLen / 2 - 14;
  const neckY = geom.bodyY - 2;
  let headX = geom.bodyLen / 2 + 4;
  let headY = geom.bodyY - geom.bodyH * 0.32 - 4;
  if (petStyle.proportions.enabled) {
    const neck = petStyle.proportions.neck;
    headX = neckX + (headX - neckX) * neck;
    headY = neckY + (headY - neckY) * neck;
  }
  if (facing) {
    headX *= headReach(facing.foreshorten) * (1 - 0.15 * facing.front);
    const chestTop = geom.bodyY + geom.bodyH * 0.08 - geom.bodyH / 2;
    const frontY = chestTop + geom.bodyH * 0.3 - geom.headR * 0.25;
    const backY = geom.bodyY - geom.bodyH * 0.9;
    const axial = Math.max(facing.front, facing.rear);
    const axialY = facing.rear > facing.front ? backY : frontY;
    headY = headY + (axialY - headY) * axial;
  }
  const natural = torsoPoint(geom, theta, dy, headX, headY);
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
  const tip = carriedMouth(
    breed,
    geom,
    headFaceOf(breed, geom, facing?.headTurn ?? 0, facing?.front ?? 0),
    facing?.rear ?? 0,
    pose.snoutScale ?? 1,
  );
  const local = {
    x: head.x + tip.x * cs - tip.y * sn,
    y: head.y + tip.x * sn + tip.y * cs,
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
