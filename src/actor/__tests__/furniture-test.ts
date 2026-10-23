import { applyFurniture, furnitureAt, normalizeFurniture, placePiece, starterFurniture, steerAim } from '../furniture';
import { sceneForSpecies, scenes } from '../scenes';
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
