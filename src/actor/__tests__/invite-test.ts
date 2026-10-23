import { createWorld, inviteCare, spawnActor, syncActor, syncWorldFood, takePendingRest, update } from '../sim';
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
