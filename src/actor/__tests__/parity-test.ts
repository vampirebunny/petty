import {
  compileScene,
  isPreset,
  sceneSource,
  scenes,
  startUserTask,
  statusOf,
  takeSounds,
  tuftsFor,
  update,
  voiceRate,
} from '..';
import { breedById, catBreeds, dogBreeds } from '../breeds';
import { nearestPoi } from '../scenes';
import { createWorld, setWorldScene, spawnActor } from '../sim';
import type { ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return { id: 'pet', breedId: 'retriever', ageDays: 0, weight: 0, vitality: 1, equipped: {}, asleep: false, ...overrides };
}

function run(world: ReturnType<typeof createWorld>, seconds: number) {
  for (let i = 0; i < seconds * 20; i += 1) {
    update(world, 0.05);
  }
}

const room = {
  sky: ['#ffffff', '#eeeeee'],
  floor: { horizon: 100, yMin: 200, yMax: 300, color: ['#cccccc', '#bbbbbb'] },
};

it('runs sit, give paw and idle on request and reports each in the status line', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup]);
  expect(startUserTask(world, pup, 'sit')).toBe(true);
  expect(pup.task.type).toBe('sit');
  expect(statusOf(pup)).toBe('Sitting');
  expect(startUserTask(world, pup, 'paw')).toBe(true);
  expect(statusOf(pup)).toBe('Giving paw');
  expect(startUserTask(world, pup, 'idle')).toBe(true);
  expect(pup.task.type).toBe('idle');
  expect(statusOf(pup)).toMatch(/^Idle, /);
});

it('raises the paw while giving paw and lowers it again afterward', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup]);
  startUserTask(world, pup, 'paw');
  run(world, 1);
  expect(pup.pose.paw).toBeGreaterThan(0.5);
  startUserTask(world, pup, 'idle');
  run(world, 1);
  expect(pup.pose.paw).toBeLessThan(0.1);
});

it('makes a sound only when the speak action barks, and only on the first beat', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup]);
  expect(startUserTask(world, pup, 'speak')).toBe(true);
  run(world, 1.5);
  const sounds = takeSounds(world);
  expect(sounds.length).toBe(1);
  expect(sounds[0].sound).toBe('bark');
  expect(sounds[0].actorId).toBe('pet');
  expect(takeSounds(world)).toEqual([]);

  // A reaction that is not a bark stays silent.
  startUserTask(world, pup, 'react', 0.1);
  run(world, 1);
  expect(takeSounds(world)).toEqual([]);
});

it('meows for a cat and scales the clip by species, breed and age', () => {
  const cat = catBreeds()[0];
  const dog = dogBreeds()[0];
  expect(voiceRate(cat, 1)).toBeCloseTo((cat.pitch * 1) / 1.5, 5);
  expect(voiceRate(dog, 1)).toBeCloseTo(dog.pitch, 5);
  expect(voiceRate(dog, 0)).toBeGreaterThan(voiceRate(dog, 1));
  const kitten = spawnActor(source({ id: 'kit', breedId: cat.id }));
  const world = createWorld([kitten]);
  startUserTask(world, kitten, 'speak');
  run(world, 1.5);
  expect(takeSounds(world)[0]?.sound).toBe('meow');
});

it('sleeps in place when the scene has no bed and wakes on request', () => {
  const pup = spawnActor(source());
  const world = createWorld([pup], 1, scenes.park);
  pup.x = 300;
  pup.y = 250;
  expect(startUserTask(world, pup, 'sleep')).toBe(true);
  expect(pup.task.stage).toBe('sleeping');
  expect(pup.x).toBe(300);
  expect(startUserTask(world, pup, 'sit')).toBe(true);
  expect(pup.asleep).toBe(false);
  expect(pup.task.type).toBe('sit');
  startUserTask(world, pup, 'sleep');
  expect(startUserTask(world, pup, 'wake')).toBe(true);
  expect(pup.task.type).not.toBe('sleep');
});

it('picks the nearest of two matching spots', () => {
  const scene = compileScene({
    ...room,
    pois: [
      { type: 'food', x: 50, y: 250 },
      { type: 'food', x: 450, y: 250 },
    ],
  });
  expect(nearestPoi(scene, 'food', { x: 400, y: 250 })?.x).toBe(450);
  expect(nearestPoi(scene, 'food', { x: 60, y: 250 })?.x).toBe(50);
  expect(nearestPoi(scene, 'water', { x: 0, y: 0 })).toBeNull();
});

it('seeds particles for a weather scene, moves them, and holds still when motion is reduced', () => {
  const scene = compileScene({ ...room, ambient: { particles: { kind: 'rain' } } });
  const world = createWorld([spawnActor(source())], 1, scene);
  expect(world.particles.length).toBeGreaterThan(0);
  const y0 = world.particles[0].y;
  run(world, 0.2);
  expect(world.particles[0].y).not.toBe(y0);

  world.reducedMotion = true;
  const y1 = world.particles[0].y;
  run(world, 0.2);
  expect(world.particles[0].y).toBe(y1);

  setWorldScene(world, scenes.livingroom);
  expect(world.particles).toEqual([]);
  expect(() => compileScene({ ...room, ambient: { particles: { kind: 'hail' } } })).toThrow(
    '"ambient.particles.kind" must be rain, snow or leaves.',
  );
});

it('draws the same grass for a scene every time', () => {
  const first = tuftsFor(scenes.park);
  expect(first).toHaveLength(110);
  expect(tuftsFor(scenes.park)).toBe(first);
  const again = compileScene(sceneSource('park'));
  expect(tuftsFor(again).map((tuft) => tuft.x)).toEqual(first.map((tuft) => tuft.x));
  expect(tuftsFor(scenes.park).map((tuft) => tuft.x)).not.toEqual(tuftsFor(scenes.livingroom).map((tuft) => tuft.x));
});

it('exposes preset scene data that compiles back and keeps the bedroom bed shape', () => {
  expect(isPreset('park')).toBe(true);
  expect(isPreset('custom')).toBe(false);
  for (const id of ['livingroom', 'park', 'bedroom']) {
    expect(compileScene(sceneSource(id)).id).toBe(id);
  }
  expect(scenes.bedroom.props.some((prop) => prop.kind === 'shape')).toBe(true);
  expect(breedById('retriever')).not.toBeNull();
});

it('eats and drinks from the side of the bowl the pet approaches from', () => {
  for (const [task, type] of [['eat', 'food'], ['drink', 'water']] as const) {
    const scene = scenes.livingroom;
    const poi = scene.pois.find((entry) => entry.type === type)!;
    for (const side of [-1, 1] as const) {
      const pup = spawnActor(source());
      const world = createWorld([pup], 1, scene);
      pup.x = poi.x - side * 120;
      pup.y = poi.y;
      expect(startUserTask(world, pup, task)).toBe(true);
      for (let i = 0; i < 400 && pup.task.stage !== 'eating'; i += 1) {
        update(world, 0.05);
      }
      expect(pup.task.stage).toBe('eating');
      expect(pup.face).toBe(side);
      // The pet stands on the side it came from.
      expect(Math.sign(poi.x - pup.x)).toBe(side);
    }
  }
});

it('stands exactly at the bowl to eat and at the water bowl to drink, in every indoor scene', () => {
  for (const scene of [scenes.livingroom, scenes.bedroom]) {
    for (const [task, type] of [['eat', 'food'], ['drink', 'water']] as const) {
      const pup = spawnActor(source());
      const world = createWorld([pup], 1, scene);
      expect(startUserTask(world, pup, task)).toBe(true);
      for (let i = 0; i < 400 && pup.task.stage !== 'eating'; i += 1) {
        update(world, 0.05);
      }
      expect(pup.task.stage).toBe('eating');
      const poi = scene.pois.find((entry) => entry.type === type)!;
      // Same baseline as the bowl, so the pet is never drawn behind it.
      expect(pup.y).toBe(poi.y);
      expect(statusOf(pup)).toBe(task === 'eat' ? 'Eating' : 'Drinking');
      run(world, 1);
      expect(pup.pose.headDown).toBeGreaterThan(0.9);
    }
  }
});
