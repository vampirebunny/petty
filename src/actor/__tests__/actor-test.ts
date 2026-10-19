import { canBehave, isUserTask, reactionFor } from '../behavior';
import { breedsFor, dogBreeds } from '../breeds';
import { bagAmount, geomOf, headFaceOf, thickOf } from '../geometry';
import { growthFor } from '../growth';
import { gaitFoot, jumpArc, solveKnee } from '../legs';
import { defaultPose, easePose } from '../pose';
import {
  createWorld,
  dropBallAt,
  frameDt,
  settleOnResume,
  spawnActor,
  stagePoint,
  startUserTask,
  takeWeightDelta,
  update,
} from '../sim';
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

function actor(asleep = false) {
  return spawnActor(source({ asleep }));
}

it('eases a pose toward its target without popping', () => {
  const pose = defaultPose();
  const next = easePose(pose, { ...pose, sit: 1 }, 0.1);
  expect(next.sit).toBeGreaterThan(0);
  expect(next.sit).toBeLessThan(1);
  expect(next.spineArch).toBe(0);
  expect(next.crouch).toBe(0);
});

it('keeps both bones the same length', () => {
  const hip = { x: 0, y: 0 };
  const foot = { x: 30, y: 10 };
  const knee = solveKnee(hip, foot, 20, 1);
  expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(20, 1);
  expect(Math.hypot(foot.x - knee.x, foot.y - knee.y)).toBeCloseTo(20, 1);
});

it('plants a foot on the ground and lifts it through the swing', () => {
  const planted = gaitFoot(0, 0, 40, 12);
  expect(planted.y).toBe(0);
  const lifted = gaitFoot(Math.PI * 2 * 0.8, 0, 40, 12);
  expect(lifted.y).toBeLessThan(0);
});

it('raises leg length on an S-curve and clamps after day 1000', () => {
  let previous = -1;
  for (let day = 0; day <= 1000; day += 25) {
    const leg = growthFor(day).leg;
    expect(leg).toBeGreaterThanOrEqual(previous);
    previous = leg;
  }
  expect(growthFor(1000)).toEqual(growthFor(1400));
  expect(growthFor(0).head).toBeLessThan(growthFor(1000).head);
  expect(thickOf(0)).toBeCloseTo(1);
  expect(thickOf(1)).toBeCloseTo(1.5);
  expect(thickOf(-1)).toBeCloseTo(0.7);
  expect(bagAmount(0, 1)).toBe(0);
  expect(bagAmount(700, 0)).toBeCloseTo(0.5, 5);
  expect(bagAmount(1000, 0)).toBe(1);
  expect(bagAmount(1000, 1)).toBe(0);
});

it('loads five dog breeds and leaves cat tasks unassigned', () => {
  expect(dogBreeds().map((breed) => breed.id)).toEqual([
    'retriever',
    'corgi',
    'dachshund',
    'husky',
    'pug',
  ]);
  expect(dogBreeds().every((breed) => breed.species === 'dog')).toBe(true);
  expect(dogBreeds().some((breed) => breed.behaviors.includes('groom'))).toBe(false);
  expect(breedsFor('cat').map((breed) => breed.id)).toEqual([
    'domesticshorthair',
    'siamese',
    'persian',
    'mainecoon',
    'bombay',
  ]);
});

it('sleeps, eats, barks, and gives a paw', () => {
  const pup = actor();
  const world = createWorld([pup]);
  pup.x = 112;
  pup.y = 272;
  startUserTask(world, pup, 'sleep');
  for (let step = 0; step < 20; step += 1) {
    update(world, 0.05);
  }
  expect(pup.task.type).toBe('sleep');
  expect(pup.pose.lie).toBeGreaterThan(0.3);

  pup.x = 450;
  pup.y = 270;
  pup.speed = 0;
  pup.vx = 0;
  pup.vy = 0;
  startUserTask(world, pup, 'wake');
  startUserTask(world, pup, 'eat');
  for (let step = 0; step < 80 && pup.task.stage !== 'eating'; step += 1) {
    update(world, 0.05);
  }
  expect(pup.task.type).toBe('eat');
  expect(pup.task.stage).toBe('eating');
  pup.task.t = 6.1;
  update(world, 0.05);
  expect(pup.task.type).toBe('idle');

  startUserTask(world, pup, 'react', 0.8);
  expect(pup.bark.active).toBe(true);
  expect(reactionFor('retriever', 0.2)).toBe('paw');
  startUserTask(world, pup, 'react', 0.1);
  expect(pup.task.type).toBe('paw');
});

it('pants after a fetch and does not start pant or groom from a request', () => {
  const pup = actor();
  const world = createWorld([pup], 4);
  expect(isUserTask('pant')).toBe(false);
  expect(canBehave(pup, 'groom')).toBe(false);
  expect(canBehave(pup, 'pounce')).toBe(false);
  pup.x = 296;
  pup.y = 272;
  pup.speed = 0;
  pup.task = { type: 'fetch', stage: 'return', t: 1, bats: 0, cool: 0 };
  world.items = [{ id: 'ball-1', kind: 'ball', state: 'carried', x: 296, y: 272, z: 0, vx: 0, vy: 0, vz: 0, holderId: pup.id }];
  update(world, 0.05);
  expect(pup.task.type).toBe('winddown');
  expect(world.items[0]?.state).toBe('free');
  update(world, 0.2);
  expect(pup.pose.pant).toBeGreaterThan(0);
  expect(pup.z).toBe(0);
});

it('steps two actors and pauses the frame clock', () => {
  const first = actor();
  const second = spawnActor(source({ id: 'friend', breedId: 'pug', ageDays: 10 }), { x: 200, y: 250 });
  const world = createWorld([first, second]);
  update(world, 0.05);
  expect(world.actors).toHaveLength(2);
  expect(world.t).toBeCloseTo(0.05);
  expect(frameDt(100, true)).toBe(0.05);
  expect(frameDt(16, false)).toBe(0);
  first.task = { type: 'eat', stage: 'eating', t: 1, bats: 0, cool: 0 };
  settleOnResume(world);
  expect(first.task.type).toBe('idle');
  expect(jumpArc(0, 0.6, 40)).toBe(0);
  expect(jumpArc(0.3, 0.6, 40)).toBeGreaterThan(30);
  expect(jumpArc(0.6, 0.6, 40)).toBeCloseTo(0, 5);
});

it('picks another idle and skips a walk when motion is reduced', () => {
  const pup = actor();
  const world = createWorld([pup], 2);
  world.waterLevel = 0;
  pup.idle.t = pup.idle.dur;
  update(world, 0.05);
  expect(pup.idle.mode).not.toBe('still');
  expect(['pant', 'nap', 'walk']).toContain(pup.idle.mode);

  const cat = spawnActor(source({ id: 'kit', breedId: 'domesticshorthair' }));
  const quiet = createWorld([cat], 3);
  quiet.waterLevel = 0;
  quiet.reducedMotion = true;
  for (let step = 0; step < 12; step += 1) {
    cat.idle.t = cat.idle.dur;
    update(quiet, 0.05);
    expect(cat.idle.mode).not.toBe('walk');
    expect(['still', 'purr', 'nap']).toContain(cat.idle.mode);
  }
});

it('picks up a ball sitting just behind the mouth', () => {
  const pup = actor();
  const world = createWorld([pup], 1);
  pup.face = 1;
  pup.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
  world.items = [{ id: 'ball-1', kind: 'ball', state: 'free', x: pup.x - 10, y: pup.y, z: 0, vx: 0, vy: 0, vz: 0 }];
  update(world, 0.05);
  expect(world.items[0]?.state).toBe('carried');
  expect(pup.task.stage).toBe('return');
});

it('lets a dog carry the ball home and a cat bat it three times', () => {
  const pup = actor();
  const chase = createWorld([pup], 5);
  chase.items = [{ id: 'ball-1', kind: 'ball', state: 'free', x: pup.x + 8, y: pup.y, z: 0, vx: 0, vy: 0, vz: 0 }];
  pup.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
  update(chase, 0.05);
  expect(chase.items[0]?.state).toBe('carried');
  expect(pup.task.stage).toBe('return');

  const kit = spawnActor(source({ id: 'kit', breedId: 'domesticshorthair' }));
  const play = createWorld([kit], 6);
  startUserTask(play, kit, 'fetch', 1, { x: kit.x, y: kit.y });
  for (let step = 0; step < 240 && kit.task.type !== 'winddown'; step += 1) {
    update(play, 0.05);
  }
  expect(kit.task.type).toBe('winddown');
  expect(canBehave(kit, 'fetch')).toBe(false);
});

it('burns weight while running and maps a tap into the stage', () => {
  const pup = actor();
  const world = createWorld([pup]);
  pup.speed = 100;
  for (let step = 0; step < 20; step += 1) {
    pup.speed = 100;
    update(world, 0.05);
  }
  expect(takeWeightDelta(pup)).toBeCloseTo(-0.003, 5);
  expect(stagePoint(100, 50, 200, 100)).toEqual({ x: 320, y: 170 });
  dropBallAt(world, 10_000, -20, false);
  expect(world.items[0]?.z).toBe(130);
  expect(world.items[0]?.x).toBeLessThanOrEqual(world.scene.floor.xMax + 12);
  expect(world.items[0]?.y).toBeGreaterThanOrEqual(world.scene.floor.yMin);
});

describe('3/4 head turn', () => {
  it('turns toward the camera only while stationary in idle or sitting', () => {
    const pup = actor();
    const world = createWorld([pup], 3);
    pup.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
    pup.idle = { mode: 'still', t: 0, dur: 99, target: null, sit: false, arrived: true };
    for (let step = 0; step < 20; step += 1) {
      update(world, 0.05);
    }
    expect(pup.pose.headTurn).toBeGreaterThan(0.9);

    startUserTask(world, pup, 'sleep');
    for (let step = 0; step < 4; step += 1) {
      update(world, 0.05);
      expect(pup.pose.walk > 0.5 ? pup.pose.headTurn : 0).toBeLessThan(0.16);
    }
  });

  it('never shows a turned head while the pet is moving', () => {
    const pup = actor();
    const world = createWorld([pup], 7);
    pup.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
    pup.idle = { mode: 'still', t: 0, dur: 99, target: null, sit: false, arrived: true };
    for (let step = 0; step < 20; step += 1) {
      update(world, 0.05);
    }
    pup.idle = { mode: 'walk', t: 0, dur: 99, target: { x: pup.x + 120, y: pup.y }, sit: false, arrived: false };
    for (let step = 0; step < 60; step += 1) {
      update(world, 0.05);
      if (pup.speed > 14) {
        expect(pup.pose.headTurn).toBeLessThanOrEqual(0.15 + 1e-9);
      }
    }
  });

  it('eases in about 300 ms and exposes anchors', () => {
    const pose = defaultPose();
    const next = easePose(pose, { ...pose, headTurn: 1 }, 0.3);
    expect(next.headTurn).toBeGreaterThan(0.9);
    expect(next.headTurn).toBeLessThan(1);
    for (const breed of [...breedsFor('dog'), ...breedsFor('cat')]) {
      const geom = geomOf(breed, 0, 0);
      const side = headFaceOf(breed, geom, 0);
      const turned = headFaceOf(breed, geom, 1);
      expect(side.farEyeAlpha).toBe(0);
      expect(turned.farEyeAlpha).toBe(1);
      expect(turned.farEye.x - turned.nearEye.x).toBeGreaterThanOrEqual(turned.eyeR * 2.4 - 1e-6);
      expect(turned.farEye.x).toBeLessThan(geom.headR);
    }
  });
});
