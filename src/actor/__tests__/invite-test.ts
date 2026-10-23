import { createWorld, inviteCare, spawnActor, takePendingRest, update } from '../sim';
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

it('ignores a second tap on an invite that is already waiting', () => {
  const { world, actor } = pup();
  expect(inviteCare(world, actor, 'bed')).toBe('went');
  expect(inviteCare(world, actor, 'bed')).toBe('already');
  expect(world.invites.filter((kind) => kind === 'bed')).toHaveLength(1);
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
