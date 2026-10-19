import { createWorld, spawnActor, startUserTask, update } from '../sim';
import type { ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 0,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    ...overrides,
  };
}

it('releases a carried item when the task changes', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1);
  world.items = [
    {
      id: 'ball-1',
      kind: 'ball',
      state: 'carried',
      x: pup.x,
      y: pup.y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      holderId: pup.id,
    },
  ];
  pup.task = { type: 'fetch', stage: 'return', t: 1, bats: 0, cool: 0 };
  startUserTask(world, pup, 'sit');
  expect(world.items[0]?.state).toBe('free');
  expect(world.items[0]?.holderId).toBeUndefined();
  update(world, 0.05);
  expect(pup.task.type).toBe('sit');
});
