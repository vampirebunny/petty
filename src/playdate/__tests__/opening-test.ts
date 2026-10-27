import { createWorld, sceneById, spawnActor, update } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { portraitFrame, portraitFrameFor, portraitSpan, portraitZoom } from '../camera';
import {
  closeEnough,
  emptyMs,
  enterLimitMs,
  gateX,
  homeA,
  homeB,
  parkOffstage,
  placeOpening,
  playSpeed,
  portraitMs,
  stepOpening,
  walkOn,
} from '../opening';
import type { OpeningState } from '../opening';
import { actorSourceOf } from '../snapshot';
import type { PetSnapshot } from '../types';

function pet(id: string): PetSnapshot {
  return {
    snapshotId: id,
    source: 'npc',
    name: id,
    species: 'dog',
    breedId: 'retriever',
    look: { coat: '#d9a441' },
    equipped: {},
    ageDays: 400,
    weight: 0,
    vitality: 1,
    seed: 1,
    originArchetype: 'athlete',
    currentStyle: 'athlete',
    attributes: { stamina: 50, agility: 50, intelligence: 50, boldness: 50, affection: 50, obedience: 50 },
    potential: { stamina: 80, agility: 80, intelligence: 80, boldness: 80, affection: 80, obedience: 80 },
    favoriteActivities: [],
    partyTricks: [],
    createdAt: 't',
  };
}

describe('playdate opening', () => {
  it('holds each pet in close-up, then an empty scene, then one entrance at a time', () => {
    let state: OpeningState = { phase: 'portraitA', elapsed: 0 };
    state = stepOpening(state, portraitMs, false);
    expect(state).toEqual({ phase: 'portraitB', elapsed: 0 });
    state = stepOpening(state, portraitMs, false);
    expect(state).toEqual({ phase: 'empty', elapsed: 0 });
    state = stepOpening(state, emptyMs, false);
    expect(state).toEqual({ phase: 'enterA', elapsed: 0 });
    state = stepOpening(state, 1000, false);
    expect(state.phase).toBe('enterA');
    state = stepOpening(state, 16, true);
    expect(state.phase).toBe('enterB');
    state = stepOpening(state, 16, true);
    expect(state.phase).toBe('play');
    expect(stepOpening(state, 4000, false).phase).toBe('play');
  });

  it('cuts off a walk that does not arrive', () => {
    const stuck = stepOpening({ phase: 'enterA', elapsed: enterLimitMs - 1 }, 1, false);
    expect(stuck.phase).toBe('enterB');
  });

  it('plays the interaction at double speed', () => {
    expect(playSpeed).toBe(2);
    expect(portraitMs).toBe(2000);
  });

  it('frames a portrait tighter than the wide stage', () => {
    const frame = portraitFrame(homeA, 439);
    expect(frame.zoom).toBe(portraitZoom);
    expect(frame.zoom).toBeGreaterThan(2);
    expect(frame.x).toBeGreaterThan(100);
    expect(frame.x).toBeLessThan(stageWidth - 100);
  });

  it('zooms a long sitting pet out so the nose and tail stay in the close-up', () => {
    const scene = sceneById('park');
    const floor = scene.floor;
    const y = (floor.yMin + floor.yMax) / 2;
    const grown = { displayAgeDays: 400, displayWeight: 0, vitality: 1, x: homeA, y };
    const pug = portraitFrameFor({ ...grown, breedId: 'pug' }, floor);
    const dachshund = portraitFrameFor({ ...grown, breedId: 'dachshund' }, floor);
    expect(pug.zoom).toBe(portraitZoom);
    expect(dachshund.zoom).toBeLessThan(portraitZoom);
    expect(dachshund.zoom).toBeGreaterThan(1.5);
    const span = portraitSpan({ ...grown, breedId: 'dachshund' }, floor);
    expect(span.width * dachshund.zoom).toBeLessThanOrEqual(stageWidth * 0.84 + 0.01);
    expect(span.height * dachshund.zoom).toBeLessThanOrEqual(stageHeight * 0.84 + 0.01);
  });

  it('parks a pet fully off-screen and walks the other in from the left', () => {
    const scene = sceneById('park');
    const floor = scene.floor;
    const y = (floor.yMin + floor.yMax) / 2;
    const left = spawnActor(actorSourceOf(pet('a')), { x: homeA, y });
    const right = spawnActor(actorSourceOf(pet('b')), { x: homeB, y });
    const world = createWorld([left, right], 1, scene);
    placeOpening('empty', left, right, floor, y);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(stageWidth);
    expect(gateX(left, floor, -1)).toBeLessThan(0);
    walkOn(left, floor, -1, homeA, y, 1);
    parkOffstage(right, floor, 1, y);
    const dt = 1 / 30;
    for (let i = 0; i < 30 * 8 && !closeEnough(left, homeA, y); i += 1) {
      update(world, dt);
    }
    expect(closeEnough(left, homeA, y)).toBe(true);
    expect(right.x).toBeGreaterThan(stageWidth);
  });
});
