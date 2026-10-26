import { breedById } from '../breeds';
import { PET_SIZE, depthScale, geomOf, xRangeOf } from '../geometry';
import { createWorld, spawnActor, startSpook, startSpookReturn, update } from '../sim';
import { scenes } from '../scenes';
import type { Actor, ActorSource, World } from '../types';

function source(): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 14,
    weight: 12,
    vitality: 1,
    equipped: {},
    asleep: false,
  };
}

function rangeOf(world: World, actor: Actor) {
  const breed = breedById(actor.breedId);
  if (!breed) {
    throw new Error('breed');
  }
  const floor = world.scene.floor;
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const scale = PET_SIZE * geom.sc * depthScale(actor.y, floor.yMin, floor.yMax);
  return xRangeOf(floor, geom, scale);
}

it('bolts a short way that stays on stage, then walks back', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.livingroom);
  const home = { x: pup.x, y: pup.y };
  const range = rangeOf(world, pup);
  expect(startSpook(world, pup)).toBe(true);
  const target = pup.task.poi?.x ?? home.x;
  expect(target).toBeGreaterThanOrEqual(range.lo);
  expect(target).toBeLessThanOrEqual(range.hi);
  expect(Math.abs(target - home.x)).toBeLessThanOrEqual(120);
  expect(Math.abs(target - home.x)).toBeGreaterThanOrEqual(36);

  for (let step = 0; step < 240 && !world.spookSettled; step += 1) {
    update(world, 0.05);
    expect(pup.x).toBeGreaterThanOrEqual(range.lo - 1);
    expect(pup.x).toBeLessThanOrEqual(range.hi + 1);
  }
  expect(world.spookSettled).toBe(true);
  expect(Math.abs(pup.x - home.x)).toBeGreaterThan(20);

  expect(startSpookReturn(world, pup)).toBe(true);
  for (let step = 0; step < 240 && !world.spookReturned; step += 1) {
    update(world, 0.05);
    expect(pup.x).toBeGreaterThanOrEqual(range.lo - 1);
    expect(pup.x).toBeLessThanOrEqual(range.hi + 1);
  }
  expect(world.spookReturned).toBe(true);
  expect(pup.x).toBeCloseTo(home.x, 0);
  expect(world.spookHome).toBeNull();
});

it('turns back instead of leaving the stage when the pet is already at the edge', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.livingroom);
  const range = rangeOf(world, pup);
  pup.x = range.hi;
  pup.face = 1;
  expect(startSpook(world, pup)).toBe(true);
  const target = pup.task.poi?.x ?? pup.x;
  expect(target).toBeLessThan(range.hi);
  expect(target).toBeGreaterThanOrEqual(range.lo);
});
