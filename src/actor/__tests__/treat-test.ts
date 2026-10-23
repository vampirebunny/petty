import { createWorld, spawnActor, startTreat, startUserTask, takeTreatFinishes, takeTreatMoods, update } from '../sim';

it('sets a treat down, then nibbles and wags until it is gone', () => {
  const actor = spawnActor({
    id: 'pet',
    breedId: 'retriever',
    ageDays: 80,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  const world = createWorld([actor], 1);
  expect(startTreat(world, actor, 'biscuit')).toBe(true);
  expect(world.items.some((item) => item.kind === 'treat:biscuit')).toBe(true);

  for (let i = 0; i < 200 && actor.task.stage !== 'nibble'; i += 1) {
    update(world, 0.05);
  }
  expect(actor.task.type).toBe('treat');
  expect(actor.task.stage).toBe('nibble');

  for (let i = 0; i < 12; i += 1) {
    update(world, 0.05);
  }
  expect(actor.pose.headDown).toBeGreaterThan(0.2);
  expect(actor.pose.wagAmp).toBeGreaterThan(0.2);

  for (let i = 0; i < 80 && actor.task.type === 'treat'; i += 1) {
    update(world, 0.05);
  }
  expect(actor.task.type).toBe('idle');
  expect(world.items.some((item) => item.kind.startsWith('treat:'))).toBe(false);
});

it('holds the mood burst until the treat is eaten', () => {
  const actor = spawnActor({
    id: 'pet',
    breedId: 'retriever',
    ageDays: 80,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  const world = createWorld([actor], 1);
  expect(startTreat(world, actor, 'biscuit', 10)).toBe(true);

  const moods: number[] = [];
  for (let i = 0; i < 400 && actor.task.type === 'treat'; i += 1) {
    update(world, 0.05);
    const gained = takeTreatMoods(world);
    if (gained.length > 0) {
      moods.push(...gained);
      expect(world.items.some((item) => item.kind.startsWith('treat:'))).toBe(false);
      break;
    }
    expect(gained).toEqual([]);
  }
  expect(moods).toEqual([10]);

  for (let i = 0; i < 80 && actor.task.type === 'treat'; i += 1) {
    update(world, 0.05);
  }
  expect(takeTreatMoods(world)).toEqual([]);
  expect(actor.task.type).toBe('idle');
});

it('waits to count the bite until the treat is eaten', () => {
  const actor = spawnActor({
    id: 'pet',
    breedId: 'retriever',
    ageDays: 80,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  const world = createWorld([actor], 1);
  expect(startTreat(world, actor, 'treat_jerky', 0)).toBe(true);

  let finishes = 0;
  for (let i = 0; i < 400 && finishes === 0; i += 1) {
    update(world, 0.05);
    finishes += takeTreatFinishes(world);
    if (finishes === 0) {
      expect(world.items.some((item) => item.kind.startsWith('treat:'))).toBe(true);
    }
  }
  expect(finishes).toBe(1);
  expect(takeTreatMoods(world)).toEqual([]);
  expect(world.items.some((item) => item.kind.startsWith('treat:'))).toBe(false);
});

it('counts the bite when the treat is interrupted', () => {
  const actor = spawnActor({
    id: 'pet',
    breedId: 'retriever',
    ageDays: 80,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  const world = createWorld([actor], 1);
  expect(startTreat(world, actor, 'biscuit', 10)).toBe(true);
  expect(startUserTask(world, actor, 'idle')).toBe(true);
  update(world, 0.05);
  expect(takeTreatFinishes(world)).toBe(1);
  expect(takeTreatMoods(world)).toEqual([10]);
});
