import { testPet } from '../../sim/__fixtures__/pets';
import { applyFurniture } from '../furniture';
import { createWorld, spawnActor, startUserTask, update } from '../sim';
import { scenes } from '../scenes';

it('grid of starts that never reach the bowl', () => {
  const pet = testPet(1, 'domesticShorthair', 10, 'Kit', 'cat');
  const scene = applyFurniture(scenes.livingroom, pet.furniture, pet.furniturePlaced);
  const failures: string[] = [];
  for (let x = 40; x <= 600; x += 40) {
    for (let y = 240; y <= 640; y += 40) {
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
      startUserTask(world, actor, 'eat');
      for (let i = 0; i < 700 && actor.task.stage !== 'eating'; i += 1) {
        update(world, 0.05);
      }
      if (actor.task.stage !== 'eating') {
        failures.push(`${x},${y} -> ${actor.x.toFixed(0)},${actor.y.toFixed(0)} ${actor.task.stage}`);
      }
    }
  }
  console.log(failures.join('\n') || 'none');
  expect(failures).toEqual([]);
});

it('logs a stuck approach from the water bowl', () => {
  const pet = testPet(1, 'domesticShorthair', 10, 'Kit', 'cat');
  const scene = applyFurniture(scenes.livingroom, pet.furniture, pet.furniturePlaced);
  const actor = spawnActor({
    id: 'pet',
    breedId: 'domesticShorthair',
    ageDays: 400,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  actor.x = 500;
  actor.y = 560;
  const world = createWorld([actor], 1, scene);
  startUserTask(world, actor, 'eat');
  const lines: string[] = [];
  lines.push(`poi ${actor.task.poi?.x},${actor.task.poi?.y} face ${actor.task.poi?.face} prop ${actor.task.poi?.propId}`);
  for (let i = 0; i < 80; i += 1) {
    update(world, 0.05);
    if (i % 4 === 0) {
      lines.push(
        `${i} ${actor.x.toFixed(1)},${actor.y.toFixed(1)} v ${actor.vx.toFixed(1)},${actor.vy.toFixed(1)} face ${actor.face} oct ${actor.octant}->${actor.octantTarget} stage ${actor.task.stage}`,
      );
    }
  }
  console.log(lines.join('\n'));
  expect(actor.task.stage).toBe('eating');
});

it('a cat on the bed still reaches the food bowl', () => {
  const pet = testPet(1, 'domesticShorthair', 10, 'Kit', 'cat');
  const scene = applyFurniture(scenes.livingroom, pet.furniture, pet.furniturePlaced);
  const failures: string[] = [];
  const spots = [
    [110, 540],
    [110, 542],
    [180, 360],
    [540, 330],
    [500, 560],
    [300, 440],
    [160, 540],
    [70, 540],
  ];
  for (const [x, y] of spots) {
    const actor = spawnActor({
      id: 'pet',
      breedId: 'domesticShorthair',
      ageDays: 400,
      weight: 0,
      vitality: 1,
      equipped: {},
      asleep: true,
    });
    actor.x = x;
    actor.y = y;
    const world = createWorld([actor], 1, scene);
    world.foodStocked = true;
    const started = startUserTask(world, actor, 'eat');
    for (let i = 0; i < 900 && actor.task.stage !== 'eating'; i += 1) {
      update(world, 0.05);
    }
    if (!started || actor.task.stage !== 'eating') {
      failures.push(
        `from ${x},${y} started=${started} ${actor.task.type}:${actor.task.stage} at ${actor.x.toFixed(0)},${actor.y.toFixed(0)}`,
      );
    }
  }
  expect(failures).toEqual([]);
});
