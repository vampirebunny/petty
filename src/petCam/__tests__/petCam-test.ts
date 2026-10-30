import type { FurniturePiece, FurniturePlacement } from '../../actor/furniture';
import { rngFrom } from '../../playdate/rng';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { homeRooms } from '../../ui/town/rooms';

import { durationOf, eligibleIds, frameAt, isNightAt } from '../clips';
import { decideShow } from '../decide';
import { clipGradeMatrix } from '../filter';
import {
  armWelcomeHomeSkip,
  clearReturnSkips,
  dismissCam,
  dropPendingCam,
  markOverlayShown,
  noteLaunchSkip,
  noteSlotSkip,
  pendingCam,
  queueCam,
  returnBlocked,
  welcomeHomeHeld,
  welcomeHomeWasReplaced,
} from '../session';
import { firstClip, pickRecord } from '../select';
import type { ClipId, ClipRecord, PetSnap, RoomId } from '../types';
import { clipVersion } from '../types';

const hourMs = 3_600_000;

function pet(species: 'dog' | 'cat' = 'dog'): PetSnap {
  return {
    species,
    breedId: species === 'cat' ? 'shorthair' : 'retriever',
    ageDays: 400,
    stage: 'adult',
    look: null,
    equipped: {},
    vitality: 0.8,
    weight: 0,
  };
}

function record(clipId: ClipId, pieces: FurniturePiece[] = [], placed: FurniturePlacement[] = [], roomId: RoomId = 'livingroom'): ClipRecord {
  return {
    clipId,
    clipVersion,
    seed: 99,
    roomId,
    recordedAt: new Date(2026, 0, 15, 14, 0, 0).getTime(),
    isNight: false,
    pet: pet(),
    pieces,
    placed,
    sweaterItemId: null,
  };
}

const water: FurniturePiece = { id: 'water', kind: 'bowl', contents: 'water' };
const bed: FurniturePiece = { id: 'bed', kind: 'bed' };
const placed: FurniturePlacement[] = [
  { pieceId: 'water', sceneId: 'livingroom', x: 220, y: 420 },
  { pieceId: 'bed', sceneId: 'livingroom', x: 360, y: 400 },
];

beforeEach(() => {
  armWelcomeHomeSkip();
  dismissCam();
  clearReturnSkips();
});

it('hides a return under 5 hours, a skipped return, and a return with nothing to play', () => {
  const away = gameplayConfig.petCam.minAwayHours * hourMs;
  expect(decideShow({ awayMs: away - 1, seen: false, skipped: false, eligible: true, roll: 0 })).toBe('hide');
  expect(decideShow({ awayMs: away, seen: false, skipped: true, eligible: true, roll: 0 })).toBe('hide');
  expect(decideShow({ awayMs: away, seen: false, skipped: false, eligible: false, roll: 0 })).toBe('hide');
});

it('guarantees the first show and rolls 15 percent after that', () => {
  const away = gameplayConfig.petCam.minAwayHours * hourMs;
  expect(decideShow({ awayMs: away, seen: false, skipped: false, eligible: true, roll: 0.99 })).toBe('show');
  expect(decideShow({ awayMs: away, seen: true, skipped: false, eligible: true, roll: 0.14 })).toBe('show');
  expect(decideShow({ awayMs: away, seen: true, skipped: false, eligible: true, roll: 0.15 })).toBe('hide');
});

it('a dropped showing does not consume the first-show guarantee', () => {
  queueCam(record('boop'));
  armWelcomeHomeSkip();
  dropPendingCam();
  expect(pendingCam()).toBeNull();
  expect(welcomeHomeHeld()).toBe(false);
  expect(welcomeHomeWasReplaced()).toBe(false);
  const away = gameplayConfig.petCam.minAwayHours * hourMs;
  expect(decideShow({ awayMs: away, seen: false, skipped: false, eligible: true, roll: 0.99 })).toBe('show');
});

it('keeps a clip that is already on screen when the app backgrounds', () => {
  queueCam(record('boop'));
  markOverlayShown();
  dropPendingCam();
  expect(pendingCam()?.clipId).toBe('boop');
  expect(welcomeHomeWasReplaced()).toBe(true);
});

it('skips the return for another phone or a notification launch', () => {
  expect(returnBlocked()).toBe(false);
  noteSlotSkip();
  expect(returnBlocked()).toBe(true);
  clearReturnSkips();
  expect(returnBlocked()).toBe(false);
  noteLaunchSkip();
  expect(returnBlocked()).toBe(true);
  expect(pendingCam()).toBeNull();
});

it('shows nothing when the only eligible clip is the previous one', () => {
  expect(firstClip([{ room: 'livingroom', ids: ['boop'] }], 'boop', () => 0)).toBeNull();
  expect(firstClip([{ room: 'livingroom', ids: ['boop', 'nap'] }], 'boop', () => 0)?.clipId).toBe('nap');
});

it('resolves the same room, clip, night, and frames from the same seed', () => {
  const leftAt = new Date(2026, 0, 15, 8, 0, 0).getTime();
  const input = {
    pet: pet('cat'),
    rooms: ['livingroom', 'bedroom', 'catio'] as RoomId[],
    pieces: [water, bed],
    placed,
    tops: [{ id: 'knit', shape: 'sweater' }],
    lastClipId: null,
    leftAt,
    returnedAt: leftAt + 8 * hourMs,
  };
  const first = pickRecord({ ...input, rng: rngFrom('petcam', 42) });
  const second = pickRecord({ ...input, rng: rngFrom('petcam', 42) });
  expect(first).toEqual(second);
  expect(first).not.toBeNull();
  if (!first) {
    return;
  }
  const times = [0, 1.5, 4, durationOf(first.clipId)];
  const frames = times.map((time) => frameAt(first, time));
  expect(times.map((time) => frameAt(first, time))).toEqual(frames);
});

it('keeps the pet inside the room frame except on clips that leave it', () => {
  const margin = gameplayConfig.petCam.edgeMargin;
  const pieces = [water, bed];
  for (const clipId of ['sweater', 'hind', 'tail', 'nap', 'bowl', 'bedPush'] as ClipId[]) {
    for (const seed of [1, 7, 42, 99]) {
      const clip = { ...record(clipId, pieces, placed.map((place) => ({ ...place }))), seed };
      for (let time = 0; time <= durationOf(clipId); time += 0.1) {
        const frame = frameAt(clip, time);
        expect(frame.x).toBeGreaterThanOrEqual(margin);
        expect(frame.x).toBeLessThanOrEqual(640 - margin);
      }
    }
  }
});

it('lets in-and-out leave the frame fully', () => {
  const clip = record('inOut');
  const xs: number[] = [];
  for (let time = 0; time <= durationOf('inOut'); time += 0.05) {
    xs.push(frameAt(clip, time).x);
  }
  expect(Math.min(...xs)).toBeLessThan(-gameplayConfig.petCam.offscreen + 20);
  expect(Math.max(...xs)).toBeGreaterThan(640 + gameplayConfig.petCam.offscreen - 20);
});

it('grows the pet for the boop without moving the room', () => {
  const clip = record('boop');
  const start = frameAt(clip, 0);
  const close = frameAt(clip, 5);
  expect(start.scale).toBe(1);
  expect(close.scale).toBeGreaterThan(2);
  expect(close.y).toBeGreaterThan(start.y);
});

it('puts the nap on the sofa or bed cushion', () => {
  const sofa = frameAt(record('nap'), 3);
  const bedNap = frameAt(record('nap', [], [], 'bedroom'), 3);
  expect(sofa.z).toBeGreaterThan(0);
  expect(bedNap.z).toBeGreaterThan(0);
  expect(sofa.onScenery).toBe(true);
});

it('gates clips by species, clothing, furniture, and room', () => {
  const none: FurniturePiece[] = [];
  const empty: FurniturePlacement[] = [];
  const dog = eligibleIds('dog', 'livingroom', none, empty, []);
  expect(dog).not.toContain('sweater');
  expect(dog).not.toContain('bowl');
  expect(dog).not.toContain('bedPush');
  expect(dog).toContain('nap');
  const dressed = eligibleIds('dog', 'livingroom', none, empty, [{ id: 'knit', shape: 'sweater' }]);
  expect(dressed).toContain('sweater');
  const watered = eligibleIds('dog', 'livingroom', [water], placed, []);
  expect(watered).toContain('bowl');
  expect(eligibleIds('dog', 'bedroom', [water], placed, [])).not.toContain('bowl');
  const beds = eligibleIds('cat', 'bedroom', [bed], [{ pieceId: 'bed', sceneId: 'bedroom', x: 300, y: 400 }], []);
  expect(beds).toContain('bedPush');
  expect(beds).not.toContain('tail');
  expect(eligibleIds('cat', 'catio', none, empty, [])).not.toContain('nap');
  expect(homeRooms('dog').map((room) => room.id)).not.toContain('catio');
  expect(homeRooms('cat').map((room) => room.id)).toContain('catio');
});

it('leaves the live placement list unchanged after a bowl or bed clip', () => {
  const bowl = record('bowl', [water], placed.map((place) => ({ ...place })));
  const before = JSON.stringify(bowl.placed);
  for (let time = 0; time <= durationOf('bowl'); time += 0.5) {
    frameAt(bowl, time);
  }
  expect(JSON.stringify(bowl.placed)).toBe(before);
  const moved = frameAt(bowl, 4).placed.find((place) => place.pieceId === 'water');
  expect(moved?.x).not.toBe(220);

  const spinning = record('bedPush', [bed], placed.map((place) => ({ ...place })));
  const bedBefore = JSON.stringify(spinning.placed);
  for (let time = 0; time <= durationOf('bedPush'); time += 0.5) {
    frameAt(spinning, time);
  }
  expect(JSON.stringify(spinning.placed)).toBe(bedBefore);
  const shoved = frameAt(spinning, 4).placed.find((place) => place.pieceId === 'bed');
  expect(shoved?.x).not.toBe(360);
});

it('keeps the grade in 0–1 color units so mid gray stays visible', () => {
  const apply = (matrix: number[], value: number) => matrix[0] * value + matrix[1] * value + matrix[2] * value + matrix[4];
  const day = apply(clipGradeMatrix(false), 0.5);
  const night = apply(clipGradeMatrix(true), 0.5);
  expect(day).toBeCloseTo(0.5, 5);
  expect(night).toBeGreaterThan(0.2);
  expect(night).toBeLessThan(0.9);
});

it('treats 2:00 as night and 14:00 as day', () => {
  expect(isNightAt(new Date(2026, 0, 15, 2, 0, 0).getTime())).toBe(true);
  expect(isNightAt(new Date(2026, 0, 15, 14, 0, 0).getTime())).toBe(false);
});
