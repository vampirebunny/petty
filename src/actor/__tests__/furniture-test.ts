import { applyEvent } from '../../sim/events';
import { testPet } from '../../sim/__fixtures__/pets';
import { applyFurniture, furnitureAt, starterFurniture, steerAim } from '../furniture';
import { sceneForSpecies, scenes } from '../scenes';
import { createWorld, spawnActor, startUserTask, update } from '../sim';

const floor = { xMin: 0, xMax: 640, yMin: 200, yMax: 650 };
const bowl = { id: 'bowl', x: 300, y: 400, hw: 34, hd: 28 };

it('reaches the food bowl from inside the litter box and the water bowl', () => {
  const pet = testPet(1, 'domesticShorthair', 10, 'Kit', 'cat');
  const scene = applyFurniture(scenes.livingroom, pet.furniture, pet.furniturePlaced);
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
  const cat = testPet(1, 'domesticShorthair', 10, 'Kit', 'cat');
  const placed = cat.furniturePlaced.map((place) =>
    place.pieceId === 'livingroom-food' ? { ...place, x: 200, y: 400 } : place,
  );
  const scene = applyFurniture(scenes.livingroom, cat.furniture, placed);
  expect(scene.props.find((prop) => prop.id === 'livingroom-food')).toMatchObject({ x: 200, y: 400 });
  expect(scene.pois.find((poi) => poi.type === 'food')).toMatchObject({ x: 200, y: 400, propId: 'livingroom-food' });
  expect(scenes.livingroom.props.find((prop) => prop.id === 'livingroom-food')).toMatchObject({ x: 540, y: 330 });
});

it('keeps the litter box out of a dog room', () => {
  const dog = testPet(1, 'retriever', 10, 'Pup', 'dog');
  const scene = applyFurniture(sceneForSpecies(scenes.livingroom, 'dog'), dog.furniture, dog.furniturePlaced);
  expect(scene.props.some((prop) => prop.kind === 'litterbox')).toBe(false);
  expect(scene.pois.some((poi) => poi.type === 'litter')).toBe(false);
  expect(dog.furniture.some((piece) => piece.kind === 'litterbox')).toBe(false);
  expect(starterFurniture('cat').pieces.some((piece) => piece.id === 'catio-tree')).toBe(true);
  expect(starterFurniture('dog').pieces.some((piece) => piece.id === 'catio-tree')).toBe(false);
});

it('hits a bowl and misses the rug', () => {
  expect(furnitureAt(scenes.livingroom, 540, 330)).toBe('livingroom-food');
  expect(furnitureAt(scenes.livingroom, 330, 440)).toBeNull();
});

it('clamps a dragged bowl to the walkable floor', () => {
  const dog = testPet(1, 'retriever', 10, 'Pup', 'dog');
  const moved = applyEvent(dog, { type: 'moveFurniture', pieceId: 'livingroom-food', sceneId: 'livingroom', x: 10, y: 10 });
  expect(moved.state.furniturePlaced.find((place) => place.pieceId === 'livingroom-food')).toMatchObject({
    sceneId: 'livingroom',
    x: scenes.livingroom.floor.xMin,
    y: scenes.livingroom.floor.yMin,
  });
  const ignored = applyEvent(dog, { type: 'moveFurniture', pieceId: 'missing', sceneId: 'livingroom', x: 100, y: 300 });
  expect(ignored.state).toBe(dog);
});
