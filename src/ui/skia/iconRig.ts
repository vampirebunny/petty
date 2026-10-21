import { bodyFrame, breedById, defaultPose } from '../../actor';
import type { Geom, HeadFace } from '../../actor/geometry';
import { visualLifespanDays } from '../../sim/config';

// One adult reference body, so every icon looks the same no matter whose pet is wearing it.
// The mirror still draws the real pet.
let cached: Geom | null = null;

export function iconGeom(): Geom {
  if (!cached) {
    const breed = breedById('retriever');
    if (!breed) {
      throw new Error('Retriever breed is missing.');
    }
    cached = bodyFrame(
      breed,
      visualLifespanDays / 2,
      0,
      1,
      defaultPose(),
      0,
      0,
      320,
      460,
      0,
      { yMin: 224, yMax: 654 },
    ).geom;
  }
  return cached;
}

// A front-facing face for glasses. Cosmetics reads the eye fields; the rest stay neutral.
export function iconFace(): HeadFace {
  return {
    eyeR: 9.5,
    nearEye: { x: -17, y: 0 },
    farEye: { x: 17, y: 0 },
    turn: 0,
    front: 1,
    farEyeAlpha: 1,
    farEyeScale: { x: 1, y: 1 },
    gap3: 34,
    top: { x: 0, y: -34 },
    muzzle: { x: 0, y: 8, rx: 10, ry: 8 },
    squareMuzzle: false,
    noseSize: 1,
    farEarShift: { x: 0, y: 0 },
    nearEarShift: { x: 0, y: 0 },
    farEarAlpha: 1,
  };
}
