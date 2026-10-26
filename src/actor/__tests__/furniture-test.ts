import { breedById, catBreeds } from '../breeds';
import { bodyFrame, geomOf, PET_SIZE, xRangeOf } from '../geometry';
import {
  adultCatBodyWidth,
  applyFurniture,
  bowlAlreadyInRoom,
  canPlaceFurniture,
  bowlRoomMessage,
  bedCushionPoint,
  furnitureAt,
  furnitureDefinition,
  keepFirstBedPerRoom,
  pillowCushionSvg,
  stackCushionSvg,
  movePiece,
  normalizeFurniture,
  otherBedInRoom,
  placementsPetCanUse,
  placePiece,
  roomRestBadge,
  shopFurnitureSpot,
  shopSku,
  skuCount,
  starterFurniture,
  stockedSkus,
  steerAim,
  cabanaWidth,
  styledBedWidth,
  stowPiece,
  syncFurniture,
} from '../furniture';
import { daysToSenior } from '../../sim/config';
import { HOUSE_REST } from '../conservatory';
import { actionReason, sceneForSpecies, scenes } from '../scenes';
import type { Scene } from '../scenes';
import { createWorld, spawnActor, startUserTask, update } from '../sim';

const floor = { xMin: 0, xMax: 640, yMin: 200, yMax: 650 };
const bowl = { id: 'bowl', x: 300, y: 400, hw: 34, hd: 28 };

it('reaches the food bowl from the left of the room and from the water bowl', () => {
  const home = starterFurniture('cat');
  const scene = applyFurniture(scenes.livingroom, home.pieces, home.placed);
  for (const [x, y] of [
    [80, 360],
    [143, 360],
    [500, 560],
    [560, 560],
  ] as const) {
    const actor = spawnActor({
      id: 'pet',
      breedId: 'domesticShorthair',
      ageDays: 80,
      weight: 0,
      vitality: 1,
      equipped: {},
      asleep: false,
    });
    actor.x = x;
    actor.y = y;
    const world = createWorld([actor], 1, scene);
    world.foodStocked = true;
    expect(startUserTask(world, actor, 'eat')).toBe(true);
    for (let i = 0; i < 900 && actor.task.stage !== 'eating'; i += 1) {
      update(world, 0.05);
    }
    expect(actor.task.stage).toBe('eating');
  }
});

it('walks off a bed that overlaps the screen edge without spinning', () => {
  const home = starterFurniture('dog');
  const scene = applyFurniture(scenes.livingroom, home.pieces, home.placed);
  const bed = scene.props.find((prop) => prop.kind === 'bed');
  expect(bed).toBeTruthy();
  const actor = spawnActor(
    { id: 'pet', breedId: 'retriever', ageDays: 400, weight: 0, vitality: 1, equipped: {}, asleep: false },
    { x: bed?.x ?? 0, y: bed?.y ?? 0 },
  );
  const world = createWorld([actor], 1, scene);
  actor.task.type = 'idle';
  actor.task.stage = '';
  actor.task.poi = undefined;
  actor.idle.mode = 'walk';
  actor.idle.dur = 999;
  actor.idle.t = 0;
  actor.idle.arrived = false;
  actor.idle.target = { x: 40, y: bed?.y ?? 0 };
  let flips = 0;
  let last = actor.octant;
  for (let i = 0; i < 180; i += 1) {
    update(world, 1 / 30);
    if (i > 60 && actor.octant !== last) {
      flips += 1;
      last = actor.octant;
    }
  }
  expect(flips).toBeLessThan(6);
  expect(Math.hypot(actor.x - (bed?.x ?? 0), actor.y - (bed?.y ?? 0))).toBeGreaterThan(40);
});

it('walks back onto the stage instead of running in place on the edge', () => {
  const actor = spawnActor(
    { id: 'pet', breedId: 'retriever', ageDays: 400, weight: 0, vitality: 1, equipped: {}, asleep: false },
    { x: 200, y: 400 },
  );
  const world = createWorld([actor], 1, scenes.livingroom);
  const breed = breedById('retriever')!;
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    actor.pose,
    0,
    0,
    actor.x,
    actor.y,
    actor.face,
    world.scene.floor,
    0,
    actor.gait,
    0,
  );
  const range = xRangeOf(world.scene.floor, frame.geom, frame.scale);
  actor.x = range.lo - 0.4;
  actor.vx = 280;
  actor.speed = 280;
  actor.task.type = 'idle';
  actor.idle.mode = 'walk';
  actor.idle.dur = 999;
  actor.idle.t = 0;
  actor.idle.arrived = false;
  actor.idle.target = { x: range.hi - 30, y: 620 };
  for (let i = 0; i < 90; i += 1) {
    update(world, 1 / 30);
  }
  expect(actor.x).toBeGreaterThan(range.lo + 40);
});

it('keeps walking past the conservatory instead of sticking to the room edge', () => {
  const home = starterFurniture('dog');
  const house = furnitureDefinition('dogHouse');
  const scene = applyFurniture(
    scenes.livingroom,
    [...home.pieces, house!],
    [...home.placed, { pieceId: 'dogHouse', sceneId: 'livingroom', x: 320, y: 530 }],
  );
  const goal = { x: 300, y: 400 };
  for (const [x, y] of [
    [40, 300],
    [80, 600],
    [600, 300],
    [320, 620],
  ] as const) {
    const actor = spawnActor(
      { id: 'pet', breedId: 'retriever', ageDays: 400, weight: 0, vitality: 1, equipped: {}, asleep: false },
      { x, y },
    );
    const world = createWorld([actor], 1, scene);
    actor.task.type = 'idle';
    actor.task.stage = '';
    actor.task.poi = undefined;
    actor.idle.mode = 'walk';
    actor.idle.dur = 999;
    actor.idle.t = 0;
    actor.idle.arrived = false;
    actor.idle.target = goal;
    let best = Infinity;
    for (let i = 0; i < 360; i += 1) {
      update(world, 1 / 30);
      best = Math.min(best, Math.hypot(goal.x - actor.x, goal.y - actor.y));
    }
    expect(best).toBeLessThan(80);
  }
});

it('reaches the food bowl when the conservatory spans the room', () => {
  const home = starterFurniture('dog');
  const house = furnitureDefinition('dogHouse');
  const scene = applyFurniture(
    scenes.livingroom,
    [...home.pieces, house!],
    [...home.placed, { pieceId: 'dogHouse', sceneId: 'livingroom', x: 320, y: 530 }],
  );
  const actor = spawnActor(
    { id: 'pet', breedId: 'retriever', ageDays: 400, weight: 0, vitality: 1, equipped: {}, asleep: false },
    { x: 500, y: 620 },
  );
  const world = createWorld([actor], 1, scene);
  world.foodStocked = true;
  expect(startUserTask(world, actor, 'eat')).toBe(true);
  for (let i = 0; i < 1500 && actor.task.stage !== 'eating'; i += 1) {
    update(world, 1 / 30);
  }
  expect(actor.task.stage).toBe('eating');
});

it('reaches the water bowl from behind the conservatory', () => {
  const home = starterFurniture('dog');
  const house = furnitureDefinition('dogHouse');
  const scene = applyFurniture(
    scenes.livingroom,
    [...home.pieces, house!],
    [...home.placed, { pieceId: 'dogHouse', sceneId: 'livingroom', x: 320, y: 530 }],
  );
  const actor = spawnActor(
    { id: 'pet', breedId: 'retriever', ageDays: 400, weight: 0, vitality: 1, equipped: {}, asleep: false },
    { x: 200, y: 280 },
  );
  const world = createWorld([actor], 2, scene);
  world.waterLevel = 1;
  expect(startUserTask(world, actor, 'drink')).toBe(true);
  for (let i = 0; i < 1500 && actor.task.stage !== 'eating'; i += 1) {
    update(world, 1 / 30);
  }
  expect(actor.task.stage).toBe('eating');
});

it('walks onto a bowl it is using and around one that is in the way', () => {
  const open = steerAim({ x: 100, y: 400 }, { x: 300, y: 400 }, [], floor);
  expect(open).toEqual({ x: 300, y: 400 });

  const around = steerAim({ x: 100, y: 400 }, { x: 500, y: 400 }, [bowl], floor);
  const nx = (around.x - bowl.x) / bowl.hw;
  const ny = (around.y - bowl.y) / bowl.hd;
  expect(nx * nx + ny * ny).toBeGreaterThan(1);
  expect(around.y).not.toBe(400);
});

it('moves a food bowl and its food spot together', () => {
  const home = starterFurniture('cat');
  const placed = home.placed.map((place) =>
    place.pieceId === 'livingroom-food' ? { ...place, x: 200, y: 400 } : place,
  );
  const scene = applyFurniture(scenes.livingroom, home.pieces, placed);
  expect(scene.props.find((prop) => prop.id === 'livingroom-food')).toMatchObject({ x: 200, y: 400 });
  expect(scene.pois.find((poi) => poi.type === 'food')).toMatchObject({ x: 200, y: 400, propId: 'livingroom-food' });
  expect(scenes.livingroom.props.find((prop) => prop.id === 'livingroom-food')).toMatchObject({ x: 540, y: 330 });
});

it('keeps the litter box out of a dog room', () => {
  const dog = starterFurniture('dog');
  const scene = applyFurniture(sceneForSpecies(scenes.livingroom, 'dog'), dog.pieces, dog.placed);
  expect(scene.props.some((prop) => prop.kind === 'litterbox')).toBe(false);
  expect(scene.pois.some((poi) => poi.type === 'litter')).toBe(false);
  expect(dog.pieces.some((piece) => piece.kind === 'litterbox')).toBe(false);
  expect(starterFurniture('cat').pieces.some((piece) => piece.kind === 'litterbox')).toBe(false);
  expect(starterFurniture('cat').pieces.some((piece) => piece.id === 'catio-tree')).toBe(false);
  expect(starterFurniture('dog').pieces.some((piece) => piece.id === 'catio-tree')).toBe(false);
  expect(starterFurniture('cat').pieces.some((piece) => piece.id === 'bedroom-food' || piece.id === 'bedroom-water')).toBe(false);
  expect(starterFurniture('cat').pieces.some((piece) => piece.id === 'livingroom-litter' || piece.id === 'bedroom-litter')).toBe(false);
});

it('drops the bedroom bowls from a save that still has them', () => {
  const kept = normalizeFurniture(
    'cat',
    [
      { id: 'bedroom-food', kind: 'bowl', contents: 'kibble' },
      { id: 'bedroom-water', kind: 'bowl', contents: 'water' },
      { id: 'livingroom-food', kind: 'bowl', contents: 'kibble' },
      { id: 'livingroom-litter', kind: 'litterbox', color: '#d9d3c7' },
      { id: 'bedroom-litter', kind: 'litterbox', color: '#d9d3c7' },
    ],
    [
      { pieceId: 'bedroom-food', sceneId: 'bedroom', x: 120, y: 340 },
      { pieceId: 'bedroom-water', sceneId: 'bedroom', x: 130, y: 590 },
      { pieceId: 'livingroom-food', sceneId: 'livingroom', x: 540, y: 330 },
      { pieceId: 'livingroom-litter', sceneId: 'livingroom', x: 180, y: 360 },
      { pieceId: 'bedroom-litter', sceneId: 'bedroom', x: 220, y: 300 },
    ],
  );
  expect(kept.furniture.map((piece) => piece.id)).toEqual(['livingroom-food']);
  expect(kept.placed.map((place) => place.pieceId)).toEqual(['livingroom-food']);
  const livingRoom = applyFurniture(scenes.livingroom, kept.furniture, kept.placed);
  expect(livingRoom.props.some((prop) => prop.kind === 'litterbox')).toBe(false);
  expect(livingRoom.pois.some((poi) => poi.type === 'litter')).toBe(false);
  const stillOwned = applyFurniture(
    scenes.livingroom,
    [{ id: 'livingroom-litter', kind: 'litterbox', color: '#d9d3c7' }],
    [{ pieceId: 'livingroom-litter', sceneId: 'livingroom', x: 180, y: 360 }],
  );
  expect(stillOwned.props.some((prop) => prop.kind === 'litterbox')).toBe(false);
  expect(stillOwned.pois.some((poi) => poi.type === 'litter')).toBe(false);
  const bedroom = applyFurniture(scenes.bedroom, kept.furniture, kept.placed);
  expect(bedroom.props.some((prop) => prop.kind === 'bowl')).toBe(false);
  expect(bedroom.props.some((prop) => prop.kind === 'litterbox')).toBe(false);
  expect(bedroom.pois.some((poi) => poi.type === 'food' || poi.type === 'water' || poi.type === 'litter')).toBe(false);
});

it('hits a bowl and misses the rug', () => {
  expect(furnitureAt(scenes.livingroom, 540, 330)).toBe('livingroom-food');
  expect(furnitureAt(scenes.livingroom, 570, 314)).toBe('livingroom-food');
  expect(furnitureAt(scenes.livingroom, 330, 440)).toBeNull();
});

it('hits the drawn bed above its floor point', () => {
  expect(furnitureAt(scenes.livingroom, 110, 506)).toBe('livingroom-bed');
  expect(furnitureAt(scenes.livingroom, 110, 522)).toBe('livingroom-bed');
  expect(furnitureAt(scenes.livingroom, 110, 470)).toBeNull();

  const cloudScale = styledBedWidth / 280;
  const caveWidth = 200;
  const caveScale = caveWidth / 280;
  const scene = {
    props: [
      { kind: 'bed' as const, id: 'cloud', x: 200, y: 500, w: styledBedWidth, bedStyle: 'cloud' as const },
      { kind: 'bed' as const, id: 'cave', x: 400, y: 520, w: caveWidth, bedStyle: 'cave' as const },
    ],
  } as Scene;
  expect(furnitureAt(scene, 200, 500 + (148 - 184) * cloudScale)).toBe('cloud');
  expect(furnitureAt(scene, 200, 500 + (136 - 184) * cloudScale)).toBe('cloud');
  expect(furnitureAt(scene, 200, 500 + (90 - 184) * cloudScale)).toBeNull();
  expect(furnitureAt(scene, 400 + (152 - 140) * caveScale, 520 + (146 - 184) * caveScale)).toBe('cave');
  expect(furnitureAt(scene, 400, 520 + 40)).toBeNull();
});

it('clamps a dragged bowl to the walkable floor', () => {
  const home = starterFurniture('dog');
  const owned = home.pieces.map((piece) => piece.id);
  const moved = placePiece(home.placed, 'livingroom-food', 'livingroom', 10, 10, owned);
  expect(moved?.find((place) => place.pieceId === 'livingroom-food')).toMatchObject({
    sceneId: 'livingroom',
    x: scenes.livingroom.floor.xMin,
    y: scenes.livingroom.floor.yMin,
  });
  expect(placePiece(home.placed, 'missing', 'livingroom', 100, 300, owned)).toBeNull();
});

it('draws a cat tree only after it is owned and placed', () => {
  const home = starterFurniture('cat');
  const bare = applyFurniture(scenes.catio, home.pieces, home.placed);
  expect(bare.props.some((prop) => prop.kind === 'catTree')).toBe(false);
  const pieces = [...home.pieces, { id: 'catio-tree', kind: 'catTree' as const }];
  const placed = [...home.placed, { pieceId: 'catio-tree', sceneId: 'catio', x: 500, y: 400 }];
  const scene = applyFurniture(scenes.catio, pieces, placed);
  expect(scene.props.find((prop) => prop.id === 'catio-tree')).toMatchObject({ kind: 'catTree', x: 500, y: 400 });
});

it('stores furniture and puts it back only in a room the player owns', () => {
  const owned = ['dogHouse', 'livingroom-food'];
  const house = placePiece([], 'dogHouse', 'bedroom', 200, 400, owned);
  expect(house?.[0]).toMatchObject({ pieceId: 'dogHouse', sceneId: 'bedroom' });
  const bowl = placePiece([], 'livingroom-food', 'bedroom', 180, 420, owned);
  expect(bowl?.[0].sceneId).toBe('bedroom');
  expect(placePiece([], 'dogHouse', 'park', 200, 400, owned)).toBeNull();
  expect(placePiece([], 'livingroom-food', 'school', 180, 420, owned)).toBeNull();
  const piece = { id: 'livingroom-food', kind: 'bowl' as const, contents: 'kibble' };
  const bedroom = applyFurniture(scenes.bedroom, [piece], bowl ?? []);
  expect(actionReason(bedroom, 'feed')).toBe('');
  expect(movePiece(bedroom, 'livingroom-food', 220, 450)?.sceneId).toBe('bedroom');
  const park = applyFurniture(scenes.park, [piece], [{ pieceId: 'livingroom-food', sceneId: 'park', x: 200, y: 400 }]);
  expect(movePiece(park, 'livingroom-food', 220, 420)).toBeNull();
  expect(stowPiece(bowl ?? [], 'livingroom-food')).toEqual([]);
  const home = starterFurniture('dog');
  const live = applyFurniture(scenes.livingroom, home.pieces, home.placed);
  const next = applyFurniture(scenes.livingroom, home.pieces, stowPiece(home.placed, 'livingroom-food'));
  expect(syncFurniture(live, next)).toContain('livingroom-food');
  expect(live.props.some((prop) => prop.id === 'livingroom-food')).toBe(false);
  expect(live.pois.some((poi) => poi.propId === 'livingroom-food')).toBe(false);
  expect(shopFurnitureSpot('dogHouse', 'park').sceneId).toBe('livingroom');
  expect(shopFurnitureSpot('scratcher', 'bedroom').sceneId).toBe('bedroom');
});

it('keeps bowls placed in a room after leaving and coming back', () => {
  const food = { id: 'bowl_food:1', kind: 'bowl' as const, catalogId: 'bowl_food' };
  const water = { id: 'bowl_water:1', kind: 'bowl' as const, catalogId: 'bowl_water' };
  const pieces = [food, water];
  const placed = [
    { pieceId: food.id, sceneId: 'bedroom', x: 180, y: 500 },
    { pieceId: water.id, sceneId: 'bedroom', x: 240, y: 520 },
  ];
  const first = applyFurniture(scenes.bedroom, pieces, placed);
  const away = applyFurniture(scenes.livingroom, pieces, placed);
  const back = applyFurniture(scenes.bedroom, pieces, placed);
  expect(back.props.filter((prop) => prop.kind === 'bowl').map((prop) => prop.id).sort()).toEqual([
    'bowl_food:1',
    'bowl_water:1',
  ]);
  expect(back.props.find((prop) => prop.id === 'bowl_food:1')).toMatchObject({ contents: 'kibble', x: 180, y: 500 });
  expect(back.props.find((prop) => prop.id === 'bowl_water:1')).toMatchObject({ contents: 'water', x: 240, y: 520 });
  expect(actionReason(back, 'feed')).toBe('');
  expect(actionReason(back, 'refillWater', 0.4)).toBe('');
  expect(actionReason(first, 'feed')).toBe('');
  expect(actionReason(away, 'feed')).toBe('There is no food bowl in this scene.');
  expect(actionReason(scenes.bedroom, 'feed')).toBe('There is no food bowl in this scene.');
  expect(actionReason(scenes.bedroom, 'refillWater', 0.4)).toBe('There is no water bowl to refill here.');
  const bare = { id: 'livingroom-food', kind: 'bowl' as const };
  const remembered = applyFurniture(scenes.bedroom, [bare], [{ pieceId: bare.id, sceneId: 'bedroom', x: 200, y: 420 }]);
  expect(remembered.props.find((prop) => prop.id === 'livingroom-food')).toMatchObject({ contents: 'kibble' });
  expect(actionReason(remembered, 'feed')).toBe('');
});

it('keeps a room to one food bowl and one water bowl', () => {
  const food = { id: 'livingroom-food', kind: 'bowl' as const, contents: 'kibble' };
  const water = { id: 'livingroom-water', kind: 'bowl' as const, contents: 'water' };
  const extra = { id: 'catio-water', kind: 'bowl' as const, contents: 'water' };
  const placed = [
    { pieceId: 'livingroom-food', sceneId: 'bedroom', x: 180, y: 420 },
    { pieceId: 'livingroom-water', sceneId: 'livingroom', x: 500, y: 560 },
  ];
  const spare = { id: 'spare-food', kind: 'bowl' as const, contents: 'kibble' };
  const pieces = [food, water, extra, spare];
  expect(bowlAlreadyInRoom(pieces, placed, 'bedroom', 'catio-water')).toBeNull();
  expect(bowlAlreadyInRoom(pieces, placed, 'bedroom', 'spare-food')).toBe('food');
  expect(bowlAlreadyInRoom(pieces, placed, 'livingroom', 'catio-water')).toBe('water');
  expect(bowlAlreadyInRoom(pieces, placed, 'bedroom', 'livingroom-food')).toBeNull();
  expect(bowlRoomMessage('food')).toBe("There's already a food bowl in this room.");
  expect(bowlRoomMessage('water')).toBe("There's already a water bowl in this room.");
});

it('leaves the scratch pole out of the catio until it is owned', () => {
  const home = starterFurniture('cat');
  expect(home.pieces.some((piece) => piece.kind === 'scratcher')).toBe(false);
  const bare = applyFurniture(scenes.catio, home.pieces, home.placed);
  expect(bare.props.some((prop) => prop.kind === 'scratcher')).toBe(false);
  const pieces = [...home.pieces, { id: 'scratcher', kind: 'scratcher' as const, h: 74 }];
  const placed = [...home.placed, { pieceId: 'scratcher', sceneId: 'catio', x: 38, y: 530 }];
  const scene = applyFurniture(scenes.catio, pieces, placed);
  expect(scene.props.find((prop) => prop.id === 'scratcher')).toMatchObject({ kind: 'scratcher', x: 38, y: 530, h: 74 });
});

it('starts a home with one living-room bed and one water bowl', () => {
  const dog = starterFurniture('dog');
  const cat = starterFurniture('cat');
  expect(dog.pieces.filter((piece) => piece.kind === 'bed').map((piece) => piece.id)).toEqual(['livingroom-bed']);
  expect(dog.placed.some((place) => place.pieceId === 'livingroom-bed' && place.sceneId === 'livingroom')).toBe(true);
  expect(dog.placed.some((place) => place.sceneId === 'bedroom' && place.pieceId.includes('bed'))).toBe(false);
  expect(cat.pieces.filter((piece) => piece.kind === 'bowl' && piece.contents === 'water')).toHaveLength(1);
  expect(cat.pieces.some((piece) => piece.id === 'catio-water')).toBe(false);
  expect(skuCount(dog.pieces, 'bed_standard')).toBe(1);
  expect(skuCount(dog.pieces, 'bowl_food')).toBe(1);
  expect(stockedSkus(dog.pieces).has('bed_standard')).toBe(false);
  expect(shopSku({ id: 'livingroom-food', kind: 'bowl', contents: 'kibble' })).toBe('bowl_food');
});

it('keeps the first bed when a room was saved with two', () => {
  const pieces = [
    { id: 'livingroom-bed', kind: 'bed' as const },
    { id: 'bed_cloud_puff', kind: 'bed' as const, catalogId: 'bed_cloud_puff' },
  ];
  const placed = [
    { pieceId: 'livingroom-bed', sceneId: 'livingroom', x: 110, y: 540 },
    { pieceId: 'bed_cloud_puff', sceneId: 'livingroom', x: 200, y: 500 },
  ];
  const repaired = keepFirstBedPerRoom(pieces, placed);
  expect(repaired.placed.map((place) => place.pieceId)).toEqual(['livingroom-bed']);
  expect(repaired.stored).toEqual([{ sceneId: 'livingroom', pieceId: 'bed_cloud_puff' }]);
  expect(otherBedInRoom(pieces, repaired.placed, 'livingroom', 'bed_cloud_puff')?.pieceId).toBe('livingroom-bed');
});

it('treats a press on the cabana as the house', () => {
  const scene = {
    props: [{ kind: 'dogHouse' as const, id: 'dogHouse', x: 320, y: 530, w: 520, flip: false }],
  } as Scene;
  expect(furnitureAt(scene, 320, 350)).toBe('dogHouse');
  expect(furnitureAt(scene, 320, 620)).toBeNull();
});

it('counts the Pup Cabana as the one bed and pays 2×', () => {
  expect(furnitureDefinition('dogHouse')).toMatchObject({ kind: 'dogHouse', w: cabanaWidth, restMultiplier: HOUSE_REST });
  const pieces = [
    { id: 'livingroom-bed', kind: 'bed' as const },
    { id: 'dogHouse', kind: 'dogHouse' as const, restMultiplier: 2 },
  ];
  const placed = [
    { pieceId: 'livingroom-bed', sceneId: 'livingroom', x: 110, y: 540 },
    { pieceId: 'dogHouse', sceneId: 'livingroom', x: 200, y: 500 },
  ];
  const repaired = keepFirstBedPerRoom(pieces, placed);
  expect(repaired.placed.map((place) => place.pieceId)).toEqual(['livingroom-bed']);
  expect(repaired.stored).toEqual([{ sceneId: 'livingroom', pieceId: 'dogHouse' }]);
  expect(otherBedInRoom(pieces, repaired.placed, 'livingroom', 'dogHouse')?.pieceId).toBe('livingroom-bed');
  expect(
    roomRestBadge(
      [{ id: 'dogHouse', kind: 'dogHouse', restMultiplier: 2 }],
      [{ pieceId: 'dogHouse', sceneId: 'livingroom', x: 200, y: 500 }],
      'livingroom',
      true,
    ),
  ).toBe('×2');
});

it('lets a bed be placed only in a room that fits it', () => {
  const standard = { id: 'bed_standard:1', kind: 'bed' as const, catalogId: 'bed_standard' };
  const dogBed = { id: 'bed_cloud_puff', kind: 'bed' as const, catalogId: 'bed_cloud_puff' };
  const catBed = { id: 'bed_kitty_cave', kind: 'bed' as const, catalogId: 'bed_kitty_cave' };
  expect(canPlaceFurniture(standard, 'livingroom', 'dog')).toBe(true);
  expect(canPlaceFurniture(standard, 'park', 'dog')).toBe(false);
  expect(canPlaceFurniture(standard, 'school', 'cat')).toBe(false);
  expect(canPlaceFurniture(dogBed, 'bedroom', 'dog')).toBe(true);
  expect(canPlaceFurniture(dogBed, 'livingroom', 'cat')).toBe(false);
  expect(canPlaceFurniture(catBed, 'catio', 'cat')).toBe(true);
  expect(canPlaceFurniture(catBed, 'bedroom', 'dog')).toBe(false);
  expect(canPlaceFurniture({ id: 'dogHouse', kind: 'dogHouse' }, 'catio', 'dog')).toBe(false);
  expect(canPlaceFurniture({ id: 'scratcher', kind: 'scratcher' }, 'livingroom', 'cat')).toBe(true);
});

it('sends a premium dog bed back to storage when this pet cannot use where it was left', () => {
  const dogBed = { id: 'bed_cloud_puff', kind: 'bed' as const, catalogId: 'bed_cloud_puff' };
  const placed = [
    { pieceId: 'bed_cloud_puff', sceneId: 'livingroom', x: 200, y: 500 },
    { pieceId: 'bed_cloud_puff', sceneId: 'park', x: 200, y: 500 },
  ];
  expect(placementsPetCanUse([dogBed], placed, 'dog').map((place) => place.sceneId)).toEqual(['livingroom']);
  expect(placementsPetCanUse([dogBed], placed, 'cat')).toEqual([]);
});

it('makes the sultan pillow at least as wide as an adult cat and the stack half of that', () => {
  const cave = furnitureDefinition('bed_kitty_cave');
  const moon = furnitureDefinition('bed_moon_cradle');
  const caveOpening = ((cave?.w ?? 0) / 280) * stackCushionSvg;
  const cradle = ((moon?.w ?? 0) / 280) * pillowCushionSvg;
  for (const breed of catBreeds()) {
    const geom = geomOf(breed, daysToSenior, 0, 1);
    const body = geom.bodyLen * PET_SIZE * geom.sc;
    expect(cradle + 1e-6).toBeGreaterThanOrEqual(body);
  }
  expect(caveOpening * 2 + 1e-6).toBeGreaterThanOrEqual(adultCatBodyWidth());
  expect(caveOpening * 2).toBeCloseTo(adultCatBodyWidth());
  expect(cradle + 1e-6).toBeGreaterThanOrEqual(adultCatBodyWidth());
  expect(furnitureDefinition('bed_cloud_puff')?.w).toBe(styledBedWidth);
  expect(furnitureDefinition('bed_bone_sofa')?.w).toBe(styledBedWidth);

  const saved = applyFurniture(
    scenes.livingroom,
    [
      { id: 'bed_kitty_cave', kind: 'bed', catalogId: 'bed_kitty_cave', bedStyle: 'cave', w: 120, restMultiplier: 2 },
      { id: 'bed_moon_cradle', kind: 'bed', catalogId: 'bed_moon_cradle', bedStyle: 'moon', w: 120, restMultiplier: 2.5 },
    ],
    [
      { pieceId: 'bed_kitty_cave', sceneId: 'livingroom', x: 200, y: 500 },
      { pieceId: 'bed_moon_cradle', sceneId: 'bedroom', x: 320, y: 500 },
    ],
  );
  expect(saved.props.find((prop) => prop.id === 'bed_kitty_cave')?.w).toBe(cave?.w);
  const live = applyFurniture(scenes.livingroom, [], []);
  syncFurniture(live, saved);
  expect(live.props.find((prop) => prop.id === 'bed_kitty_cave')?.w).toBe(cave?.w);
});

it('draws an owned premium dog bed from its id when the save has no style', () => {
  const saved = applyFurniture(
    scenes.livingroom,
    [{ id: 'bed_cloud_puff', kind: 'bed' }],
    [{ pieceId: 'bed_cloud_puff', sceneId: 'livingroom', x: 200, y: 500 }],
  );
  expect(saved.props.find((prop) => prop.id === 'bed_cloud_puff')?.bedStyle).toBe('cloud');
  const live = applyFurniture(scenes.livingroom, [], []);
  live.props.push({ id: 'bed_cloud_puff', kind: 'bed', x: 110, y: 540, w: 112, color: '#c2653d' });
  syncFurniture(live, saved);
  expect(live.props.find((prop) => prop.id === 'bed_cloud_puff')?.bedStyle).toBe('cloud');
});

it('puts a sleeper in the middle of the cushion', () => {
  for (const id of ['bed_cloud_puff', 'bed_bone_sofa', 'bed_kitty_cave', 'bed_moon_cradle', 'dogHouse'] as const) {
    const piece = furnitureDefinition(id);
    const scene = applyFurniture(
      scenes.livingroom,
      [piece!],
      [{ pieceId: id, sceneId: 'livingroom', x: 300, y: 500 }],
    );
    const prop = scene.props.find((item) => item.id === id);
    const poi = scene.pois.find((item) => item.propId === id && item.type === 'bed');
    const middle = bedCushionPoint(prop!);
    expect(poi?.x).toBeCloseTo(middle.x);
    expect(poi?.y).toBeCloseTo(middle.y);
    expect(middle.x).toBeCloseTo(prop!.x + (id === 'bed_kitty_cave' ? ((prop!.w ?? 0) / 280) * 12 : 0), 0);
  }
});
