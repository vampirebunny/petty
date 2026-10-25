import { snapFacing } from '../facing';
import { createWorld, placeTrickProp, spawnActor, startSceneEnter, startTrick, update } from '../sim';
import { scenes } from '../scenes';
import type { ActorSource } from '../types';

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

it('clears placed trick props when a scene begins', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.livingroom);
  placeTrickProp(world, { instanceId: 'podium', type: 'podium', sourceTrickId: 'dog_jump_up' }, pup.x + 40, pup.y);
  expect(world.trickProps).toHaveLength(1);
  startSceneEnter(world, pup, scenes.bedroom);
  expect(world.trickProps).toEqual([]);
});

it('finishes Stand Tall without turning the pet around', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.livingroom);
  snapFacing(pup, -1);
  expect(startTrick(world, pup, 'dog_stand_tall', 'success', [])).toBe(true);
  let face: 1 | -1 = pup.face >= 0 ? 1 : -1;
  for (let step = 0; step < 400 && !world.trickFinished; step += 1) {
    update(world, 0.05);
    if (pup.task.type === 'trick') {
      face = pup.face >= 0 ? 1 : -1;
    }
  }
  expect(world.trickFinished).toBe(true);
  expect(face).toBe(-1);
});
