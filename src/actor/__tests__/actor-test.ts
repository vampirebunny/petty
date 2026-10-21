import { bagSpanDays, bagStartDay, visualLifespanDays } from '../../sim/config';
import { canBehave, isUserTask, reactionFor } from '../behavior';
import { breedsFor, dogBreeds } from '../breeds';
import { bagAmount, geomOf, headFaceOf, thickOf } from '../geometry';
import { growthFor } from '../growth';
import { gaitFoot, solveKnee } from '../legs';
import { defaultPose, easePose } from '../pose';
import {
  createWorld,
  dropBallAt,
  frameDt,
  settleOnResume,
  spawnActor,
  stagePoint,
  startUserTask,
  takeEnergyDelta,
  takeEnergyPops,
  takeHungerDelta,
  takeThirstDelta,
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

it('raises leg length on an S-curve and clamps after the visual lifespan', () => {
  let previous = -1;
  for (let day = 0; day <= visualLifespanDays; day += visualLifespanDays / 8) {
    const leg = growthFor(day).leg;
    expect(leg).toBeGreaterThanOrEqual(previous);
    previous = leg;
  }
  expect(growthFor(visualLifespanDays)).toEqual(growthFor(visualLifespanDays + 40));
  expect(growthFor(0).head).toBeLessThan(growthFor(visualLifespanDays).head);
  expect(thickOf(0)).toBeCloseTo(1);
  expect(thickOf(1)).toBeCloseTo(1.5);
  expect(thickOf(-1)).toBeCloseTo(0.7);
  expect(bagAmount(0, 1)).toBe(0);
  expect(bagAmount(bagStartDay + bagSpanDays / 2, 0)).toBeCloseTo(0.5, 5);
  expect(bagAmount(bagStartDay + bagSpanDays, 0)).toBe(1);
  expect(bagAmount(visualLifespanDays, 1)).toBe(0);
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
    'domesticShorthair',
    'siamese',
    'persian',
    'maineCoon',
    'scottishFold',
  ]);
});

it('sleeps, eats, barks, and gives a paw', () => {
  const pup = actor();
  const world = createWorld([pup]);
  pup.x = 110;
  pup.y = 542;
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
  pup.x = 300;
  pup.y = 440;
  pup.speed = 0;
  pup.task = { type: 'fetch', stage: 'return', t: 1, bats: 0, cool: 0 };
  world.items = [{ id: 'ball-1', kind: 'ball', state: 'carried', x: 300, y: 440, z: 0, vx: 0, vy: 0, vz: 0, holderId: pup.id }];
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
});

it('picks another idle and skips a walk when motion is reduced', () => {
  const pup = actor();
  const world = createWorld([pup], 2);
  world.waterLevel = 0;
  pup.idle.t = pup.idle.dur;
  update(world, 0.05);
  expect(pup.idle.mode).not.toBe('still');
  expect(['pant', 'nap', 'walk']).toContain(pup.idle.mode);

  const cat = spawnActor(source({ id: 'kit', breedId: 'domesticShorthair' }));
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

  const kit = spawnActor(source({ id: 'kit', breedId: 'domesticShorthair' }));
  const play = createWorld([kit], 6);
  startUserTask(play, kit, 'fetch', 1, { x: kit.x, y: kit.y });
  for (let step = 0; step < 240 && kit.task.type !== 'winddown'; step += 1) {
    update(play, 0.05);
  }
  expect(kit.task.type).toBe('winddown');
  expect(canBehave(kit, 'fetch')).toBe(false);
});

it('spends energy while running and restores it during an idle nap', () => {
  const runner = actor();
  runner.energy = 1;
  const zooming = createWorld([runner], 4);
  runner.idle.mode = 'zoom';
  runner.idle.dur = 30;
  runner.zoom = { leg: 0, legs: 4, first: -1 };
  for (let step = 0; step < 80; step += 1) {
    update(zooming, 0.05);
  }
  expect(takeEnergyDelta(runner)).toBeLessThan(0);
  expect(takeHungerDelta(runner)).toBeGreaterThan(0);
  expect(takeThirstDelta(runner)).toBeGreaterThan(0);

  const sleeper = actor();
  const napping = createWorld([sleeper], 5);
  sleeper.idle.mode = 'nap';
  sleeper.idle.arrived = true;
  sleeper.idle.dur = 30;
  for (let step = 0; step < 40; step += 1) {
    update(napping, 0.05);
  }
  expect(sleeper.idle.mode).toBe('nap');
  expect(takeEnergyDelta(sleeper)).toBeGreaterThan(0);
  expect(takeHungerDelta(sleeper)).toBe(0);
  expect(takeThirstDelta(sleeper)).toBe(0);

  const resting = actor(true);
  const bed = createWorld([resting], 6);
  for (let step = 0; step < 40; step += 1) {
    update(bed, 0.05);
  }
  expect(takeEnergyDelta(resting)).toBe(0);
  expect(takeHungerDelta(resting)).toBe(0);
  expect(takeThirstDelta(resting)).toBe(0);
});

it('empties the tummy while playing even if the pet is standing still', () => {
  const pup = actor();
  const world = createWorld([pup], 8);
  pup.task = { type: 'travel', stage: 'exit', t: 0, bats: 0, cool: 0 };
  pup.task.poi = { x: pup.x, y: pup.y };
  pup.speed = 0;
  pup.vx = 0;
  pup.vy = 0;
  for (let step = 0; step < 40; step += 1) {
    pup.speed = 0;
    pup.vx = 0;
    pup.vy = 0;
    update(world, 0.05);
  }
  expect(takeHungerDelta(pup)).toBeGreaterThan(0);
  expect(takeEnergyDelta(pup)).toBeLessThan(0);
  expect(takeThirstDelta(pup)).toBeGreaterThan(0);
});

it('gives energy after a user sleep of at least five seconds', () => {
  const pup = actor();
  const world = createWorld([pup], 12);
  pup.x = 400;
  pup.y = 400;
  startUserTask(world, pup, 'sleep');
  expect(pup.task.stage).toBe('go');
  for (let step = 0; step < 120; step += 1) {
    pup.x = 400;
    pup.y = 400;
    update(world, 0.05);
  }
  expect(pup.task.stage).toBe('go');
  expect(takeEnergyDelta(pup)).toBe(0);
  expect(takeEnergyPops(pup)).toBe(0);

  pup.x = 110;
  pup.y = 542;
  pup.speed = 0;
  pup.vx = 0;
  pup.vy = 0;
  for (let step = 0; step < 20 && pup.task.stage !== 'sleeping'; step += 1) {
    update(world, 0.05);
  }
  expect(pup.task.stage).toBe('sleeping');
  takeEnergyDelta(pup);
  takeEnergyPops(pup);
  for (let step = 0; step < 20; step += 1) {
    update(world, 0.05);
  }
  expect(takeEnergyDelta(pup)).toBe(0);
  expect(takeEnergyPops(pup)).toBe(0);

  for (let step = 0; step < 120; step += 1) {
    update(world, 0.05);
  }
  expect(takeEnergyDelta(pup)).toBeCloseTo(10, 5);
  expect(takeEnergyPops(pup)).toBe(1);
});

it('collapses to sleep at empty energy and wakes with a little energy', () => {
  const pup = actor();
  pup.energy = 0;
  const world = createWorld([pup], 11);
  update(world, 0.05);
  expect(pup.asleep).toBe(true);
  expect(pup.task.type).toBe('sleep');
  expect(pup.collapseLeft).toBeGreaterThan(0);
  expect(startUserTask(world, pup, 'fetch')).toBe(false);
  for (let step = 0; step < 120; step += 1) {
    update(world, 0.05);
  }
  expect(pup.asleep).toBe(false);
  expect(takeEnergyDelta(pup)).toBeCloseTo(10, 5);
});

it('burns weight while playing even when the pet is too slow to sprint', () => {
  const pup = actor();
  pup.weight = 0.8;
  pup.syncedWeight = 0.8;
  const world = createWorld([pup], 9);
  for (let step = 0; step < 40; step += 1) {
    pup.task = { type: 'winddown', stage: 'groom', t: 0, bats: 0, cool: 0 };
    pup.speed = 0;
    pup.vx = 0;
    pup.vy = 0;
    update(world, 0.05);
  }
  expect(takeWeightDelta(pup)).toBeLessThan(0);
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
  expect(stagePoint(100, 50, 200, 100)).toEqual({ x: 320, y: 340 });
  expect(stagePoint(150, 50, 300, 100, 200)).toEqual({ x: 320, y: 340 });
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

  it('faces the direction it is walking, including through a turnaround', () => {
    const pup = actor();
    const world = createWorld([pup], 1);
    pup.face = 1;
    pup.vx = 80;
    pup.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
    pup.idle = { mode: 'walk', t: 0, dur: 99, target: { x: pup.x - 220, y: pup.y }, sit: false, arrived: false };
    let reversed = false;
    let opposed = 0;
    for (let step = 0; step < 100; step += 1) {
      update(world, 0.05);
      const against = pup.speed > 14 && pup.vx * pup.face < 0 && Math.abs(pup.vx) > 40;
      opposed = against ? opposed + 0.05 : 0;
      expect(opposed).toBeLessThan(0.2);
      if (pup.speed > 14 && Math.abs(pup.vx) > 40 && !against) {
        expect(pup.face).toBe(pup.vx > 0 ? 1 : -1);
      }
      expect(pup.anchors.facing).toBe(pup.face);
      if (pup.vx < -8) {
        reversed = true;
      }
    }
    expect(reversed).toBe(true);
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
