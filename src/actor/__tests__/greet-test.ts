import { beginGreeting, createWorld, patGreeting, spawnActor, update } from '../sim';
import { motionMods, planGreeting, scriptFor } from '../greetings';
import { stepFacing } from '../turn';
import type { ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 14,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    energy: 0.8,
    ...overrides,
  };
}

const sequence = (values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

it('slows a tired pet and keeps a puppy quicker than an adult', () => {
  const pup = motionMods(0, 1, 80);
  const adult = motionMods(14, 1, 80);
  const tired = motionMods(14, 1, 20);
  expect(pup.pace).toBeLessThan(adult.pace);
  expect(pup.hop).toBeGreaterThan(adult.hop);
  expect(tired.pace).toBeCloseTo(adult.pace * 1.15, 5);
  expect(tired.hop).toBeCloseTo(adult.hop * 0.75, 5);
  expect(pup.tumble).toBeGreaterThan(0);
  expect(adult.tumble).toBe(0);
});

it('blends pace across the day before a stage change', () => {
  const before = motionMods(1.2, 1, 80);
  const edge = motionMods(1.7, 1, 80);
  expect(edge.pace).toBeGreaterThan(before.pace);
  expect(edge.pace).toBeLessThan(motionMods(3, 1, 80).pace);
});

it('does not greet a quick return and does not repeat the stored combo greeting', () => {
  const base = {
    species: 'dog' as const,
    energy: 80,
    affection: 20,
    boldness: 20,
    affectionPotential: 40,
    boldnessPotential: 40,
    ageDays: 14,
    vitality: 1,
    asleep: false,
    reduced: false,
    lastId: null,
    rng: sequence([0, 0, 0]),
  };
  expect(planGreeting({ ...base, elapsedH: 0.01 })).toBeNull();
  expect(planGreeting({ ...base, elapsedH: 4 / 60 })?.ids).toEqual(['wag']);
  const once = planGreeting({ ...base, elapsedH: 5 / 60 });
  expect(once?.ids).not.toEqual(['wag']);
  expect(once?.ids).toHaveLength(1);
  expect(once?.storeId).toBeNull();
  const combo = planGreeting({ ...base, elapsedH: 13, rng: sequence([0, 0.99]) });
  expect(combo?.ids).toHaveLength(2);
  expect(combo?.storeId).toBe(combo?.ids[1]);
  const again = planGreeting({ ...base, elapsedH: 13, lastId: combo?.storeId ?? null, rng: sequence([0, 0.5]) });
  expect(again?.ids).not.toContain(combo?.storeId);
});

it('waits to flip facing until speed has pointed the other way', () => {
  const actor = spawnActor(source());
  actor.vx = -80;
  stepFacing(actor, 0.1, false);
  expect(actor.face).toBe(1);
  stepFacing(actor, 0.06, false);
  expect(actor.face).toBe(-1);
  actor.face = 1;
  actor.faceHold = 0.2;
  stepFacing(actor, 0.2, true);
  expect(actor.face).toBe(1);
  expect(actor.faceHold).toBe(0);
});

it('lets only the greeting write facing, and a pat window extends once', () => {
  const world = createWorld([spawnActor(source())]);
  const actor = world.actors[0];
  const plan = planGreeting({
    species: 'dog',
    elapsedH: 3,
    energy: 80,
    affection: 30,
    boldness: 10,
    affectionPotential: 40,
    boldnessPotential: 40,
    ageDays: 14,
    vitality: 1,
    asleep: false,
    reduced: false,
    lastId: null,
    rng: sequence([0.2]),
  });
  expect(plan).not.toBeNull();
  if (!plan) {
    return;
  }
  const rollover = scriptFor('rollover', 14, 1, 80, sequence([0]));
  expect(rollover?.steps.some((step) => step.patWindow)).toBe(true);
  actor.task = {
    type: 'greet',
    stage: '',
    t: 0,
    bats: 0,
    cool: 0,
    ownsFacing: true,
    greet: {
      steps: rollover?.steps ?? [],
      index: rollover?.steps.findIndex((step) => step.patWindow) ?? 0,
      stepT: 0,
      extra: 0,
      delay: 0,
      storeId: null,
      phase: 'run',
      armed: true,
      patUsed: false,
      march: false,
      faceCam: 0,
      headFront: 0,
      patWindow: true,
      move: null,
      speed: 0,
      untilArrive: false,
      hopAir: 0,
      skid: false,
    },
  };
  actor.vx = -100;
  update(world, 0.2);
  expect(actor.face).toBe(1);
  expect(patGreeting(world, actor)).toBe('bonus');
  expect(actor.task.greet?.extra).toBeCloseTo(1.2);
  expect(patGreeting(world, actor)).toBe('repeat');
  expect(actor.task.greet?.extra).toBeCloseTo(1.2);
});

it('clears pose, wag, and march when the next step omits them', () => {
  const world = createWorld([spawnActor(source())]);
  const actor = world.actors[0];
  beginGreeting(world, actor, {
    ids: ['probe'],
    steps: [
      { dur: 0.2, pose: { faceCam: 1, sit: 1 }, wag: { amp: 0.9, rate: 12 }, march: true },
      { dur: 0.2 },
    ],
    storeId: null,
    start: null,
    label: 'probe',
  });
  const run = actor.task.greet;
  expect(run).toBeDefined();
  if (!run) {
    return;
  }
  run.delay = 0;
  update(world, 0.05);
  expect(run.faceCam).toBe(1);
  expect(run.march).toBe(true);
  for (let step = 0; step < 6; step += 1) {
    update(world, 0.05);
  }
  expect(run.index).toBe(1);
  expect(run.faceCam).toBe(0);
  expect(run.headFront).toBe(0);
  expect(run.march).toBe(false);
  expect(actor.pose.sit).toBeLessThan(1);
});

it('waits out a turn already in progress before a spin starts', () => {
  const world = createWorld([spawnActor(source())]);
  const actor = world.actors[0];
  beginGreeting(world, actor, {
    ids: ['spin'],
    steps: [{ dur: 0.7, hop: 200, spin: true }],
    storeId: null,
    start: null,
    label: 'spin',
  });
  const run = actor.task.greet;
  expect(run).toBeDefined();
  if (!run) {
    return;
  }
  run.delay = 0;
  actor.turning = true;
  actor.lead = 0.2;
  update(world, 0.05);
  expect(run.phase).toBe('wait');
  expect(actor.spin).toBeNull();
  expect(actor.vz).toBe(0);
  actor.turning = false;
  actor.lead = 0;
  const face = actor.face;
  update(world, 0.05);
  expect(actor.spin).not.toBeNull();
  expect(actor.task.greet?.hopAir).toBeGreaterThan(0);
  expect(actor.face).toBe(face >= 0 ? -1 : 1);
});

it('leaves the wiggle and crouch channels out of every greeting', () => {
  const ids = ['zoomies', 'bounce', 'bow', 'runup', 'fetch', 'wiggle', 'rollover', 'howl', 'wag'];
  ids.forEach((id) => {
    const plan = scriptFor(id, 14, 1, 80, sequence([0]));
    plan?.steps.forEach((step) => {
      expect(step.pose?.wiggle ?? 0).toBe(0);
      expect(step.pose?.crouch ?? 0).toBe(0);
    });
  });
  const long = planGreeting({
    species: 'dog',
    elapsedH: 13,
    energy: 80,
    affection: 20,
    boldness: 20,
    affectionPotential: 40,
    boldnessPotential: 40,
    ageDays: 14,
    vitality: 1,
    asleep: false,
    reduced: false,
    lastId: null,
    rng: sequence([0, 0]),
  });
  expect(long?.ids).toHaveLength(2);
  expect(long?.ids).not.toContain('sitAndLook');
});
