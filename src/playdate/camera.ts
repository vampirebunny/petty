import { breedById } from '../actor/breeds';
import { depthScale, geomOf, PET_SIZE, reachOf, rearOf, stageHeight, stageWidth } from '../actor/geometry';
import { easeInOutSine } from '../actor/pose';
import { rngFrom } from './rng';
import type { Beat } from './types';

export const baseCamera = { x: stageWidth / 2, y: stageHeight * 0.62, zoom: 1 };

export type CameraFrame = { x: number; y: number; zoom: number };
export type FrozenCenter = { x: number; y: number };

const punchIn = 180;
const punchHold = 400;
const punchOut = 200;
const punchWindow = punchIn + punchHold + punchOut;
const shakeWindow = 200;
const punchGain = 0.06;

function punchAmount(age: number): number {
  if (age <= 0) {
    return 0;
  }
  if (age < punchIn) {
    return easeInOutSine(age / punchIn);
  }
  if (age <= punchIn + punchHold) {
    return 1;
  }
  if (age >= punchWindow) {
    return 0;
  }
  return 1 - easeInOutSine((age - punchIn - punchHold) / punchOut);
}

// Close-up on one pet. The lift aims above the feet so the head stays in frame.
export const portraitZoom = 3;
const portraitLift = 56;
// How much of the close-up the sitting pet may fill. A long body zooms out instead of losing its nose or tail.
const portraitFill = 0.84;

type PortraitPet = {
  breedId: string;
  displayAgeDays: number;
  displayWeight: number;
  vitality: number;
  x: number;
  y: number;
};

// Nose-to-tail and feet-to-ears of the sitting pet, in stage units. Sitting tips the body up, so a long low dog stays wide.
export function portraitSpan(
  pet: Pick<PortraitPet, 'breedId' | 'displayAgeDays' | 'displayWeight' | 'vitality' | 'y'>,
  floor: { yMin: number; yMax: number },
): { width: number; height: number } {
  const breed = breedById(pet.breedId);
  if (!breed) {
    return { width: 0, height: 0 };
  }
  const geom = geomOf(breed, pet.displayAgeDays, pet.displayWeight, pet.vitality);
  const scale = PET_SIZE * geom.sc * depthScale(pet.y, floor.yMin, floor.yMax);
  return {
    width: (reachOf(geom) + rearOf(geom)) * Math.cos(geom.aSit) * scale,
    height: (geom.L + geom.bodyH + geom.headR * 2.4) * scale,
  };
}

export function portraitZoomFor(pet: Pick<PortraitPet, 'breedId' | 'displayAgeDays' | 'displayWeight' | 'vitality' | 'y'>, floor: { yMin: number; yMax: number }): number {
  const span = portraitSpan(pet, floor);
  const zoomW = span.width > 0 ? (stageWidth * portraitFill) / span.width : portraitZoom;
  const zoomH = span.height > 0 ? (stageHeight * portraitFill) / span.height : portraitZoom;
  return Math.min(portraitZoom, zoomW, zoomH);
}

export function portraitFrame(x: number, y: number, zoom = portraitZoom): CameraFrame {
  const center = clampCenter(x, y - portraitLift, zoom);
  return { x: center.x, y: center.y, zoom };
}

export function portraitFrameFor(pet: PortraitPet, floor: { yMin: number; yMax: number }): CameraFrame {
  return portraitFrame(pet.x, pet.y, portraitZoomFor(pet, floor));
}

function clampCenter(x: number, y: number, zoom: number): { x: number; y: number } {
  const halfW = stageWidth / zoom / 2;
  const top = (stageHeight * 0.62) / zoom;
  const bottom = (stageHeight * 0.38) / zoom;
  return {
    x: Math.min(stageWidth - halfW, Math.max(halfW, x)),
    y: Math.min(stageHeight - bottom, Math.max(top, y)),
  };
}

function punchFrame(age: number, frozen: FrozenCenter): CameraFrame {
  const amount = punchAmount(age);
  const zoom = baseCamera.zoom * (1 + punchGain * amount);
  const center = clampCenter(
    baseCamera.x + (frozen.x - baseCamera.x) * amount,
    baseCamera.y + (frozen.y - baseCamera.y) * amount,
    zoom,
  );
  return { x: center.x, y: center.y, zoom };
}

function shakeFrame(seed: number, beatT: number, age: number): CameraFrame {
  const bucket = Math.floor(age / 16);
  const rng = rngFrom(seed, 'shake', beatT, bucket);
  return {
    x: baseCamera.x + (rng() * 2 - 1) * 3,
    y: baseCamera.y + (rng() * 2 - 1) * 3,
    zoom: baseCamera.zoom,
  };
}

// The latest camera beat still inside its window. Undefined matches today's framing.
export function cameraAt(
  beats: readonly Beat[],
  elapsed: number,
  frozenCenters: ReadonlyMap<number, FrozenCenter>,
  reduced: boolean,
  seed: number,
): CameraFrame | undefined {
  if (reduced) {
    return undefined;
  }
  let found: { beat: Beat; index: number } | null = null;
  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i];
    if (beat.t > elapsed) {
      break;
    }
    const window = beat.camera === 'punch' ? punchWindow : beat.camera === 'shake' ? shakeWindow : 0;
    if (window > 0 && elapsed - beat.t <= window) {
      found = { beat, index: i };
    }
  }
  if (!found) {
    return undefined;
  }
  const age = elapsed - found.beat.t;
  if (found.beat.camera === 'shake') {
    return shakeFrame(seed, found.beat.t, age);
  }
  return punchFrame(age, frozenCenters.get(found.index) ?? { x: baseCamera.x, y: baseCamera.y });
}
