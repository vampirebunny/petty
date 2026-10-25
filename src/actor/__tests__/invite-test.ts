import { newCuddle } from '../cuddle';
import { applyFurniture, furnitureDefinition } from '../furniture';
import { createWorld, inviteCare, setDirection, spawnActor, startHeld, syncActor, syncWorldFood, takeEnergyPops, takePendingRest, update } from '../sim';
import { scenes } from '../scenes';
import type { ActorSource } from '../types';

function pup() {
  const source: ActorSource = {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: false,
  };
  const actor = spawnActor(source);
  actor.x = 110;
  actor.y = 542;
  const world = createWorld([actor], 1, scenes.livingroom);
  return { world, actor };
}

it('starts a free pet toward food and keeps a later invite queued', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(inviteCare(world, actor, 'water')).toBe('queued');
  expect(world.invites).toEqual(['food', 'water']);
  expect(actor.task.kind).not.toBe('drink');
  update(world, 0.05);
  expect(world.invites).toContain('water');
});

it('walks to a bowl that was filled before the eat cue arrived', () => {
  const { world, actor } = pup();
  syncWorldFood(world, true);
  expect(world.invites).toEqual(['food']);
  expect(actor.task.type).not.toBe('eat');
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(actor.task.kind).not.toBe('drink');
});

it('ignores a second tap on an invite that is already waiting', () => {
  const { world, actor } = pup();
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(inviteCare(world, actor, 'bed')).toBe('already');
  expect(world.invites.filter((kind) => kind === 'bed')).toHaveLength(1);
});

it('restarts a meal when the bowl is full but the eat task was dropped', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  world.invites = ['food'];
  world.serving = 'food';
  actor.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
  update(world, 0.05);
  expect(actor.task.type).toBe('eat');
  expect(actor.task.kind).not.toBe('drink');
  expect(world.serving).toBe('food');
});

it('sends a sitting pet to bed instead of leaving the invite stuck', () => {
  const { world, actor } = pup();
  actor.task = { type: 'sit', stage: '', t: 0, bats: 0, cool: 0 };
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.task.type).toBe('sleep');
  expect(actor.task.stage).toBe('go');
  expect(inviteCare(world, actor, 'bed')).toBe('already');
});

it('wakes a sim-asleep pet and walks him to the bed', () => {
  const { world, actor } = pup();
  actor.asleep = true;
  actor.task = { type: 'sleep', stage: 'sleeping', t: 0, bats: 0, cool: 0 };
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.asleep).toBe(false);
  expect(actor.task.stage).toBe('go');
});

it('keeps the walk when the pet record wakes during the trip', () => {
  const { actor } = pup();
  actor.asleep = true;
  actor.task = { type: 'sleep', stage: 'go', t: 0, bats: 0, cool: 0, poi: { x: 110, y: 542 } };
  syncActor(actor, {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  expect(actor.task.type).toBe('sleep');
  expect(actor.task.stage).toBe('go');
  expect(actor.asleep).toBe(false);
});

it('pays standard bed rest after the pet record marks them asleep on the cushion', () => {
  const { world, actor } = pup();
  actor.asleep = false;
  actor.task = {
    type: 'sleep',
    stage: 'sleeping',
    t: 0,
    bats: 0,
    cool: 0,
    poi: { x: 110, y: 542, propId: 'livingroom-bed' },
  };
  syncActor(actor, {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: true,
  });
  expect(actor.task.poi?.propId).toBe('livingroom-bed');
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(takeEnergyPops(actor)).toEqual([5]);
});

it('pays standard bed rest from the cushion when the sleep task lost its bed id', () => {
  const { world, actor } = pup();
  actor.asleep = true;
  actor.task = { type: 'sleep', stage: 'sleeping', t: 0, bats: 0, cool: 0, poi: { x: 110, y: 542 } };
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(actor.task.poi?.propId).toBe('livingroom-bed');
  expect(takeEnergyPops(actor)).toEqual([5]);
});

const shopBeds = [
  ['bed_standard', 5],
  ['bed_cloud_puff', 10],
  ['bed_bone_sofa', 12.5],
  ['bed_kitty_cave', 10],
  ['bed_moon_cradle', 12.5],
] as const;

function worldWithBed(sku: string, breedId: string) {
  const piece = furnitureDefinition(sku);
  if (!piece) {
    throw new Error(sku);
  }
  const scene = applyFurniture(scenes.livingroom, [piece], [
    { pieceId: piece.id, sceneId: 'livingroom', x: 320, y: 450 },
  ]);
  const actor = spawnActor({
    id: 'pup',
    breedId,
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  actor.x = 200;
  actor.y = 440;
  const world = createWorld([actor], 1, scene);
  return { world, actor };
}

it.each(shopBeds)('pays %s rest (%s) on the cushion, even if the bed id was dropped', (sku, gain) => {
  const breedId = sku === 'bed_kitty_cave' || sku === 'bed_moon_cradle' ? 'domesticShorthair' : 'retriever';
  const { world, actor } = worldWithBed(sku, breedId);
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  for (let step = 0; step < 800 && actor.task.stage !== 'sleeping'; step += 1) {
    update(world, 0.05);
  }
  expect(actor.task.stage).toBe('sleeping');
  expect(actor.task.poi?.propId).toBe(sku);
  syncActor(actor, {
    id: 'pup',
    breedId,
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: true,
  });
  expect(actor.task.poi?.propId).toBe(sku);
  actor.energy = 0.4;
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(takeEnergyPops(actor)).toEqual([gain]);

  actor.energy = 0.4;
  actor.task.poi = { x: actor.x, y: actor.y };
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(takeEnergyPops(actor)).toEqual([gain]);
});

it('pays the base rest rate for a guest on a deluxe bed', () => {
  const { world, actor } = worldWithBed('bed_moon_cradle', 'domesticShorthair');
  actor.guest = true;
  actor.x = 320;
  actor.y = 450;
  actor.asleep = true;
  actor.task = {
    type: 'sleep',
    stage: 'sleeping',
    t: 0,
    bats: 0,
    cool: 0,
    poi: { x: actor.x, y: actor.y, propId: 'bed_moon_cradle' },
  };
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(takeEnergyPops(actor)).toEqual([5]);
});

it('pays the floor rate when the pet is asleep off the bed', () => {
  const { world, actor } = pup();
  actor.x = 400;
  actor.y = 400;
  actor.asleep = true;
  actor.task = { type: 'sleep', stage: 'sleeping', t: 0, bats: 0, cool: 0 };
  actor.sleepSec = 5;
  update(world, 0.05);
  expect(takeEnergyPops(actor)).toEqual([3]);
});

it('walks to a bowl prop when the scene has no food point', () => {
  const { world, actor } = pup();
  world.scene = {
    ...world.scene,
    pois: world.scene.pois.filter((poi) => poi.type !== 'food'),
  };
  world.foodStocked = true;
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(actor.task.poi?.propId).toBe('livingroom-food');
});

it('lies down when the bed center is outside the standing range', () => {
  const { world, actor } = pup();
  actor.x = 300;
  actor.y = 440;
  actor.vx = 0;
  actor.vy = 0;
  actor.speed = 0;
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  for (let step = 0; step < 800 && !world.pendingRest; step += 1) {
    update(world, 0.05);
  }
  expect(actor.task.stage).toBe('sleeping');
  expect(actor.asleep).toBe(false);
  expect(takePendingRest(world)).toBe(true);
});

it('lies down on the bedroom bed from the middle of the room', () => {
  const actor = spawnActor({
    id: 'pup',
    breedId: 'retriever',
    ageDays: 400,
    weight: 24,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  actor.x = 300;
  actor.y = 470;
  const world = createWorld([actor], 2, scenes.bedroom);
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  for (let step = 0; step < 800 && !world.pendingRest; step += 1) {
    update(world, 0.05);
  }
  expect(actor.task.stage).toBe('sleeping');
  expect(takePendingRest(world)).toBe(true);
});

it('sends a playing pet to the bowl without waiting for the toy', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  actor.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
  actor.direction = { target: { x: 420, y: 450 }, pace: 1, pose: 'run', token: 1 };
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(actor.task.kind).not.toBe('drink');
  expect(actor.direction).toBeNull();
  update(world, 0.05);
  expect(actor.task.type).toBe('eat');
});

it('sends a cuddling pet to the bowl', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  actor.task = { type: 'cuddle', stage: '', t: 0, bats: 0, cool: 0 };
  actor.cuddle = newCuddle(actor, world.rng);
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(actor.cuddle).toBeNull();
});

it('drops the wand and goes to the bowl', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  startHeld(world, 'wand');
  expect(actor.task.type).toBe('held');
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(world.held).toBeNull();
});

it('does not let a hello pull the pet off a meal', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  expect(inviteCare(world, actor, 'food')).toBe('went');
  setDirection(actor, { target: { x: 420, y: 450 }, pace: 0.5, pose: 'walk', token: 3 });
  expect(actor.task.type).toBe('eat');
  expect(actor.direction).toBeNull();
});

it('sends a playing pet to drink, then lets a meal cut in front', () => {
  const { world, actor } = pup();
  actor.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
  expect(inviteCare(world, actor, 'water')).toBe('went');
  expect(actor.task.kind).toBe('drink');
  world.foodStocked = true;
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(actor.task.kind).not.toBe('drink');
  expect(world.invites).toContain('water');
});

it('puts a playing pet to bed without waiting for the toy', () => {
  const { world, actor } = pup();
  actor.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
  actor.direction = { target: { x: 420, y: 450 }, pace: 1, pose: 'run', token: 1 };
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.task.type).toBe('sleep');
  expect(actor.task.stage).toBe('go');
  expect(actor.direction).toBeNull();
  update(world, 0.05);
  expect(actor.task.type).toBe('sleep');
});

it('puts a cuddling pet to bed', () => {
  const { world, actor } = pup();
  actor.task = { type: 'cuddle', stage: '', t: 0, bats: 0, cool: 0 };
  actor.cuddle = newCuddle(actor, world.rng);
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.task.type).toBe('sleep');
  expect(actor.cuddle).toBeNull();
});

it('drops the wand and goes to bed', () => {
  const { world, actor } = pup();
  startHeld(world, 'wand');
  expect(actor.task.type).toBe('held');
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.task.type).toBe('sleep');
  expect(world.held).toBeNull();
});

it('leaves a meal and goes to bed', () => {
  const { world, actor } = pup();
  world.foodStocked = true;
  expect(inviteCare(world, actor, 'food')).toBe('went');
  expect(actor.task.type).toBe('eat');
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(actor.task.type).toBe('sleep');
  expect(actor.task.stage).toBe('go');
  expect(world.invites[0]).toBe('bed');
});

it('waits out a room change, then sleeps ahead of a waiting meal', () => {
  const { world, actor } = pup();
  actor.task = { type: 'travel', stage: 'enter', t: 0, bats: 0, cool: 0, poi: { x: actor.x, y: actor.y } };
  world.foodStocked = true;
  world.invites = ['food'];
  expect(inviteCare(world, actor, 'bed')).toBe('queued');
  expect(world.invites[0]).toBe('bed');
  expect(actor.task.type).toBe('travel');
  update(world, 0.05);
  expect(actor.task.type).toBe('sleep');
});

it('does not let a hello stand the pet up once sleep has started', () => {
  const { world, actor } = pup();
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  setDirection(actor, { target: { x: 420, y: 450 }, pace: 0.5, pose: 'walk', token: 2 });
  expect(actor.task.type).toBe('sleep');
  expect(actor.direction).toBeNull();
});

it('keeps the pet awake until he is lying on the bed', () => {
  const { world, actor } = pup();
  inviteCare(world, actor, 'bed');
  expect(actor.asleep).toBe(false);
  expect(actor.task.stage).toBe('go');
  expect(takePendingRest(world)).toBe(false);
  for (let step = 0; step < 500 && !world.pendingRest; step += 1) {
    update(world, 0.05);
  }
  expect(actor.task.stage).toBe('sleeping');
  expect(actor.asleep).toBe(false);
  expect(takePendingRest(world)).toBe(true);
});
