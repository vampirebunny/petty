import { scenes } from '../scenes';
import { compileScene } from '../scenes';
import { spawnBirds, stepBirds } from '../birds';
import type { BirdSpot, BirdWorld } from '../birds';
import { createWorld, spawnActor, takeMoodPops, update } from '../sim';
import type { ActorSource } from '../types';

const day: BirdWorld = { dark: 0, precip: null, month: 5, xMin: -20, xMax: 660, yTop: 0 };
const night: BirdWorld = { ...day, dark: 1 };

function source(breedId: string): ActorSource {
  return {
    id: 'pet',
    breedId,
    ageDays: 16,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    energy: 0.8,
    mood: 0.8,
    cuddleAffinity: 0.8,
    stats: { stamina: 0.5, agility: 0.5, boldness: 0.8, obedience: 0.5 },
  };
}

describe('park birds', () => {
  it('rejects an unknown bird species', () => {
    expect(() =>
      compileScene({
        v: 1,
        sky: ['#a9d8f0', '#e2f3f8'],
        floor: { horizon: 100, yMin: 140, yMax: 400, color: ['#86c46f', '#6fae5b'] },
        birds: [{ x: 1, y: 2, on: 'ground', species: ['crow'] }],
      }),
    ).toThrow('species');
  });

  it('keeps a ground flock inside its count and can leave a spot empty', () => {
    const spot: BirdSpot = {
      x: 180,
      y: 480,
      on: 'ground',
      count: 3,
      chance: 1,
      species: ['sparrow'],
    };
    for (let seed = 1; seed < 40; seed += 1) {
      const birds = spawnBirds([spot], day, seed);
      expect(birds.length).toBeGreaterThanOrEqual(1);
      expect(birds.length).toBeLessThanOrEqual(3);
      expect(birds.every((bird) => bird.species === 'sparrow')).toBe(true);
    }
    expect(spawnBirds([{ ...spot, chance: 0 }], day, 2)).toEqual([]);
  });

  it('never places a duck or an owl in the park', () => {
    const spots = scenes.park.birds ?? [];
    expect(spots.some((spot) => spot.on === 'water')).toBe(false);
    for (let seed = 1; seed < 30; seed += 1) {
      const birds = spawnBirds(spots, day, seed);
      expect(birds.every((bird) => bird.species !== 'duck' && bird.species !== 'owl')).toBe(true);
    }
    expect(spawnBirds([{ x: 10, y: 10, on: 'ground', chance: 1, species: ['robin'] }], { ...day, month: 0 }, 1)).toEqual(
      [],
    );
  });

  it('flies off from a pet or an airborne toy, and leaves at night', () => {
    const spot = { x: 100, y: 200, on: 'ground' as const, count: 1, chance: 1, species: ['sparrow'] as ['sparrow'] };
    const scared = spawnBirds([spot], day, 1);
    scared[0].state = 'idle';
    scared[0].dur = 30;
    scared[0].x = 100;
    scared[0].y = 200;
    stepBirds(scared, 0.05, [{ x: 130, y: 200, speed: 20, scare: 1 }], day);
    expect(scared[0].state).toBe('flyOut');

    const toy = spawnBirds([spot], day, 1);
    toy[0].state = 'idle';
    toy[0].dur = 30;
    toy[0].x = 100;
    toy[0].y = 200;
    stepBirds(toy, 0.05, [{ x: 180, y: 200, speed: 300, scare: 1.3 }], day);
    expect(toy[0].state).toBe('flyOut');

    const dusk = spawnBirds([spot], day, 1);
    dusk[0].state = 'idle';
    dusk[0].dur = 30;
    dusk[0].st = 0;
    for (let i = 0; i < 30; i += 1) {
      stepBirds(dusk, 0.05, [], night);
    }
    const left = dusk[0].state as string;
    expect(left === 'flyOut' || left === 'away').toBe(true);
  });
});

describe('cat stalk', () => {
  function parkWithBird(breedId: string) {
    const actor = spawnActor(source(breedId));
    actor.x = 280;
    actor.y = 450;
    actor.idle.t = 10;
    actor.idle.dur = 1;
    actor.idle.arrived = true;
    const world = createWorld([actor], 1, scenes.park);
    world.scene = { ...world.scene, pois: world.scene.pois.filter((poi) => poi.type !== 'water') };
    world.rng = () => 0;
    const birds = spawnBirds(
      [{ x: 420, y: 450, on: 'ground', count: 1, chance: 1, roam: 1, roamY: 1, species: ['sparrow'] }],
      day,
      1,
    );
    const bird = birds[0];
    bird.state = 'idle';
    bird.dur = 60;
    bird.st = 0;
    bird.x = 420;
    bird.y = 450;
    world.birds = birds;
    return { world, actor, bird };
  }

  it('has the cat creep and pounce without paying mood', () => {
    const { world, actor } = parkWithBird('domesticShorthair');
    let jumped = false;
    for (let i = 0; i < 400 && !jumped; i += 1) {
      update(world, 0.05);
      if (actor.jump) {
        jumped = true;
      }
    }
    expect(jumped).toBe(true);
    expect(takeMoodPops(actor)).toEqual([]);
  });

  it('does not send a dog after a bird', () => {
    const { world, actor } = parkWithBird('retriever');
    for (let i = 0; i < 80; i += 1) {
      update(world, 0.05);
      expect(actor.idle.mode).not.toBe('stalk');
      expect(actor.jump).toBeNull();
    }
  });
});
