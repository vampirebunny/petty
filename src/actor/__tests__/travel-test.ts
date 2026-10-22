import { poiOf, scenes } from '../scenes';
import { stageWidth } from '../geometry';
import { createWorld, spawnActor, startSceneEnter, startSceneExit, syncActor, update } from '../sim';
import type { ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 16,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    ...overrides,
  };
}

function run(world: ReturnType<typeof createWorld>, seconds: number): void {
  for (let i = 0; i < seconds / 0.05; i += 1) {
    update(world, 0.05);
  }
}

it('walks a sleeping pet off the right edge, including a collapse nap', () => {
  const pup = spawnActor(source({ asleep: true }));
  const world = createWorld([pup], 1, scenes.livingroom);
  pup.x = 110;
  pup.y = 540;
  pup.face = -1;
  pup.collapseLeft = 3;
  pup.task = { type: 'sleep', stage: 'sleeping', t: 0, bats: 0, cool: 0, poi: { x: 110, y: 542 } };
  pup.pose = { ...pup.pose, lie: 1, headRest: 1, eyes: 1 };
  startSceneExit(world, pup);
  expect(pup.collapseLeft).toBe(0);
  expect(pup.task.type).toBe('travel');
  syncActor(pup, source({ asleep: true }));
  expect(pup.task.type).toBe('travel');
  run(world, 8);
  expect(pup.x).toBeGreaterThan(stageWidth);
});

it('walks the pet off the right edge, then in from the left of the next scene', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.livingroom);
  pup.x = 280;
  pup.y = 400;
  startSceneExit(world, pup);
  expect(pup.task.type).toBe('travel');
  expect(pup.task.stage).toBe('exit');
  run(world, 6);
  expect(pup.x).toBeGreaterThan(stageWidth);

  startSceneEnter(world, pup, scenes.park);
  expect(world.scene.id).toBe('park');
  expect(pup.x).toBeLessThan(0);
  expect(pup.face).toBe(1);
  const home = poiOf(world.scene, 'home');
  expect(home).not.toBeNull();
  run(world, 6);
  expect(Math.abs(pup.x - home!.x)).toBeLessThan(16);
  expect(pup.task.type).toBe('idle');
});
