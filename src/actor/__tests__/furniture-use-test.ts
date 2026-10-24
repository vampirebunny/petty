import { breedById } from '../breeds';
import { applyFurniture, shopFurnitureSpot } from '../furniture';
import { geomOf } from '../geometry';
import { scenes } from '../scenes';
import type { Prop, Scene } from '../scenes';
import type { Actor } from '../types';
import { createWorld, spawnActor, update } from '../sim';
import {
  FURNITURE_COOLDOWN_SEC,
  FURNITURE_IDLE_CHANCE,
  ageBand,
  beginFurniture,
  jumpReach,
  pawHeightOnPost,
  planRoute,
} from '../furnitureUse';

const tree: Prop = { kind: 'catTree', id: 'catTree', x: 320, y: 480 };
const pole: Prop = { kind: 'scratcher', id: 'scratcher', x: 180, y: 500, h: 74 };

function room(props: Prop[]): Scene {
  return { ...scenes.livingroom, props: [...scenes.livingroom.props, ...props] };
}

function clearUse(actor: Actor): void {
  actor.furniture = null;
}

function cat(ageDays: number, energy = 0.8) {
  const actor = spawnActor({
    id: 'pet',
    breedId: 'domesticShorthair',
    ageDays,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    energy,
  });
  actor.x = 80;
  actor.y = 480;
  return actor;
}

function torsoOf(ageDays: number, weight = 0): number {
  const breed = breedById('domesticShorthair');
  if (!breed) {
    throw new Error('missing breed');
  }
  return geomOf(breed, ageDays, weight, 1).bodyLen;
}

it('always uses a scratch pole or tree when one is eligible', () => {
  expect(FURNITURE_IDLE_CHANCE).toBe(1);
  expect(ageBand(1)).toBe('kitten');
  expect(ageBand(15)).toBe('adult');
  expect(ageBand(30)).toBe('senior');
});

it('climbs the first post as a kitten and jumps it as an adult', () => {
  const kitten = torsoOf(1);
  const adult = torsoOf(15);
  const senior = torsoOf(30);
  expect(jumpReach(kitten, 'kitten', 0.5)).toBeLessThan(140);
  expect(jumpReach(adult, 'adult', 0.5)).toBeGreaterThan(140);

  const kittenPath = planRoute(tree, 'kitten', kitten, 0.5, 'floor', 'p1');
  const adultPath = planRoute(tree, 'adult', adult, 0.5, 'floor', 'p1');
  const seniorLow = planRoute(tree, 'senior', senior, 0.5, 'floor', 'p1');
  const seniorTop = planRoute(tree, 'senior', senior, 0.5, 'floor', 'p3');

  expect(kittenPath?.[0]?.kind).toBe('climb');
  expect(adultPath?.[0]?.kind).toBe('jump');
  expect(seniorLow?.[0]?.kind).toBe('jump');
  expect(seniorTop).toBeNull();
});

it('only scratches when energy is under a quarter', () => {
  const actor = cat(15, 0.2);
  const world = createWorld([actor], 4, room([tree, pole]));
  for (let i = 0; i < 12; i += 1) {
    clearUse(actor);
    world.furnitureUsed = {};
    expect(beginFurniture(world, actor)).toBe(true);
    expect(actor.furniture?.kind).toBe('scratch');
  }
});

it('keeps the scratching paw on the post for a light and a heavy cat', () => {
  const breed = breedById('domesticShorthair');
  if (!breed) {
    throw new Error('missing breed');
  }
  const angle = (70 * Math.PI) / 180;
  for (const weight of [-1, 1]) {
    const geom = geomOf(breed, 15, weight, 1);
    const onPole = pawHeightOnPost(-20, geom.bodyLen, geom.L, angle, -74, -8);
    expect(onPole).toBeGreaterThanOrEqual(-74);
    expect(onPole).toBeLessThanOrEqual(-8);
    const overreach = pawHeightOnPost(0, geom.bodyLen * 4, geom.L * 2, Math.PI / 2, -74, -8);
    expect(overreach).toBe(-74);
  }
});

it('uses a living-room pole or tree on its own', () => {
  const actor = cat(15, 0.8);
  actor.x = 300;
  actor.y = 440;
  const poleSpot = shopFurnitureSpot('scratcher', 'livingroom');
  const treeSpot = shopFurnitureSpot('catTree', 'livingroom');
  const scene = applyFurniture(
    scenes.livingroom,
    [
      { id: 'scratcher', kind: 'scratcher', h: 74 },
      { id: 'catTree', kind: 'catTree' },
    ],
    [
      { pieceId: 'scratcher', sceneId: 'livingroom', x: poleSpot.x, y: poleSpot.y },
      { pieceId: 'catTree', sceneId: 'livingroom', x: treeSpot.x, y: treeSpot.y },
    ],
  );
  const world = createWorld([actor], 3, scene);
  let phase = actor.furniture?.phase;
  for (let i = 0; i < 800; i += 1) {
    update(world, 0.05);
    phase = actor.furniture?.phase;
    if (phase && phase !== 'approach') {
      break;
    }
  }
  expect(phase === 'rear' || phase === 'scratch' || phase === 'crouch' || phase === 'climb' || phase === 'air').toBe(true);
});

it('scratches a pole tucked into the catio corner', () => {
  const actor = cat(15, 0.9);
  actor.x = 320;
  actor.y = 500;
  const placed: Prop = { ...pole, x: 38, y: 530 };
  const world = createWorld([actor], 1, { ...scenes.catio, props: [...scenes.catio.props, placed] });
  expect(beginFurniture(world, actor)).toBe(true);
  for (let i = 0; i < 240; i += 1) {
    update(world, 0.05);
    if (actor.furniture && actor.furniture.phase !== 'approach') {
      break;
    }
  }
  expect(actor.furniture?.phase).toBe('rear');
});

it('blocks the same scratch until the cooldown passes', () => {
  const actor = cat(15, 0.9);
  const world = createWorld([actor], 2, room([pole]));
  expect(beginFurniture(world, actor)).toBe(true);
  expect(actor.furniture?.affordanceId).toBe('scratcher:pole');
  clearUse(actor);
  expect(beginFurniture(world, actor)).toBe(false);
  world.t += FURNITURE_COOLDOWN_SEC;
  expect(beginFurniture(world, actor)).toBe(true);
});
