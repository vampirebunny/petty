import { cuddleTouch, cuddleZoneAt, endCuddle, setCuddleGesturing, takeCuddleOut } from '../cuddle';
import { cuddleParamsFor, stageFactor } from '../data/cuddle';
import { breedsFor } from '../breeds';
import { defaultPose, easeInOutSine, springUp } from '../pose';
import { cuddleBellyMoodGain, cuddleMoodGain } from '../../sim/config';
import { createWorld, spawnActor, startUserTask, takeMoodPops, takeSounds, update } from '../sim';
import type { Actor, CuddleOut, Pose, World } from '../types';

const dt = 1 / 60;
const breedIds = [...breedsFor('dog'), ...breedsFor('cat')].map((breed) => breed.id);
const ages = [0, 30, 100, 300, 800];

function setup(breedId: string, ageDays = 100, at?: { x: number; y: number }, affinity = 1) {
  const actor = spawnActor(
    { id: 'pet', breedId, ageDays, weight: 0, vitality: 1, equipped: {}, asleep: false, cuddleAffinity: affinity },
    at,
  );
  const world = createWorld([actor], 1);
  return { world, actor };
}

function run(world: World, seconds: number, each?: (frame: number) => void): void {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i += 1) {
    each?.(i);
    update(world, dt);
  }
}

function phaseOf(actor: Actor) {
  return actor.cuddle?.phase ?? null;
}

// Largest one-frame change of any channel, as a fraction of that channel's range.
const span: Partial<Record<keyof Pose, number>> = { headDx: 6, headDy: 6, torsoShift: 4, breathRate: 3, wagAmp: 1 };
function channelDelta(a: Pose, b: Pose): number {
  let worst = 0;
  for (const key of Object.keys(a) as (keyof Pose)[]) {
    const delta = Math.abs(a[key] - b[key]) / (span[key] ?? 1);
    if (delta > worst) {
      worst = delta;
    }
  }
  return worst;
}

describe('cuddle data', () => {
  it('scales durations by life stage and keeps thresholds', () => {
    const young = cuddleParamsFor('retriever', 'dog', 100);
    const senior = cuddleParamsFor('retriever', 'dog', 400, 0);
    expect(senior.timing.settle).toBeGreaterThan(young.timing.settle);
    expect(senior.timing.waitTimeout).toBe(young.timing.waitTimeout);
    expect(stageFactor(400, 0)).toBeGreaterThan(stageFactor(400, 1));
    expect(stageFactor(400, 1)).toBeGreaterThan(stageFactor(100));
  });

  it('applies species and breed overrides', () => {
    expect(cuddleParamsFor('retriever', 'dog').tolerance.max).toBe(55);
    expect(cuddleParamsFor('siamese', 'cat').tolerance.max).toBe(24);
    expect(cuddleParamsFor('dachshund', 'dog').posture).toBe('stand');
    expect(cuddleParamsFor('pug', 'dog').posture).toBe('sit');
  });

  it('has an ease-in-out curve and a spring that overshoots then settles', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0);
    expect(easeInOutSine(1)).toBeCloseTo(1);
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5);
    expect(Math.max(...[0.05, 0.1, 0.15, 0.2].map((t) => springUp(t)))).toBeGreaterThan(1);
    expect(springUp(2)).toBeCloseTo(1, 2);
    expect(defaultPose().snoutScale).toBe(1);
  });
});

describe('cuddle enter and settle', () => {
  it('settles where the pet stands, with headTurn 0, then sits and turns the head', () => {
    const { world, actor } = setup('retriever', 100, { x: 90, y: 560 });
    run(world, 2);
    expect(actor.pose.headTurn).toBeGreaterThan(0.9);
    startUserTask(world, actor, 'cuddle');
    expect(actor.task.type).toBe('cuddle');
    const startX = actor.x;
    const startY = actor.y;
    let sawApproach = false;
    run(world, 12, () => {
      if (phaseOf(actor) === 'approach') {
        sawApproach = true;
        // The turned head eases away over the first moments of the walk.
        if ((actor.cuddle?.t ?? 0) > 0.5) {
          expect(actor.pose.headTurn).toBeLessThanOrEqual(0.1);
        }
      }
      if (actor.speed > 14) {
        expect(actor.pose.headTurn).toBeLessThanOrEqual(0.16);
      }
    });
    expect(sawApproach).toBe(true);
    expect(Math.hypot(actor.x - startX, actor.y - startY)).toBeLessThan(40);
    expect(phaseOf(actor)).toBe('waiting');
    expect(actor.pose.sit).toBeGreaterThan(0.9);
    expect(actor.pose.headTurn).toBeGreaterThan(0.9);
  });

  it('finds head, nose and back zones once settled', () => {
    const { world, actor } = setup('retriever');
    startUserTask(world, actor, 'cuddle');
    run(world, 4);
    expect(phaseOf(actor)).toBe('waiting');
    const head = actor.anchors.head;
    const hx = actor.x + actor.face * actor.anchors.scale * head.x;
    const hy = actor.y + actor.anchors.scale * head.y;
    expect(['head', 'nose']).toContain(cuddleZoneAt(actor, hx, hy));
    expect(cuddleZoneAt(actor, actor.x - 600, actor.y - 600)).toBeNull();
    let found = new Set<string | null>();
    for (let gx = -120; gx <= 120; gx += 6) {
      for (let gy = -160; gy <= 20; gy += 6) {
        found.add(cuddleZoneAt(actor, actor.x + gx, actor.y + gy));
      }
    }
    expect(found.has('nose')).toBe(true);
    expect(found.has('head')).toBe(true);
    expect(found.has('back')).toBe(true);
    expect(found.has('belly')).toBe(false);
  });
});

describe('cuddle reactions', () => {
  function settled(breedId = 'retriever') {
    const ctx = setup(breedId);
    startUserTask(ctx.world, ctx.actor, 'cuddle');
    run(ctx.world, 4);
    takeSounds(ctx.world);
    return ctx;
  }

  it('half-closes the eyes and leans toward a stroke', () => {
    const { world, actor } = settled();
    run(world, 1, () => cuddleTouch(world, actor, { kind: 'move', zone: 'back', x: actor.x + 60 }));
    expect(actor.pose.squint).toBeGreaterThan(0.4);
    expect(actor.pose.squint).toBeLessThan(0.6);
    expect(Math.abs(actor.pose.headDx)).toBeGreaterThan(1);
    expect(Math.abs(actor.pose.headRot)).toBeLessThanOrEqual(0.09);
    expect(Math.abs(actor.pose.torsoShift)).toBeLessThanOrEqual(3.01);
    expect(actor.pose.earBack).toBeGreaterThan(0.1);
  });

  it('keeps cat ears forward and raises its tail on a stroke', () => {
    const { world, actor } = settled('domesticShorthair');
    run(world, 2, () => cuddleTouch(world, actor, { kind: 'move', zone: 'back', x: actor.x }));
    expect(actor.pose.earBack).toBeCloseTo(0, 1);
    expect(actor.pose.tailLift).toBeGreaterThan(0.6);
  });

  it('plays a boop, and the 4th boop in 2 s is a head shake', () => {
    const { world, actor } = settled();
    const boop = () => cuddleTouch(world, actor, { kind: 'boop', zone: 'nose', x: actor.x });
    boop();
    expect(actor.cuddle?.reaction?.kind).toBe('boop');
    expect(takeSounds(world)).toHaveLength(0);
    let minSnout = 1;
    run(world, 0.4, () => {
      minSnout = Math.min(minSnout, actor.pose.snoutScale);
    });
    expect(minSnout).toBeLessThan(0.97);
    run(world, 1);
    boop();
    run(world, 0.1);
    boop();
    expect(actor.cuddle?.reaction?.kind).toBe('boop');
    run(world, 0.1);
    boop();
    expect(actor.cuddle?.reaction?.kind).toBe('headShake');
  });

  it('ignores a boop that is not on the nose', () => {
    const { world, actor } = settled();
    cuddleTouch(world, actor, { kind: 'boop', zone: 'back', x: actor.x });
    expect(actor.cuddle?.reaction).toBeNull();
  });

  it('flinches on a too-fast swipe and tilts into a scratch', () => {
    const { world, actor } = settled();
    cuddleTouch(world, actor, { kind: 'flinch', zone: 'back', x: actor.x });
    expect(actor.cuddle?.reaction?.kind).toBe('flinch');
    run(world, 0.2);
    expect(actor.pose.earBack).toBeGreaterThan(0.1);
    run(world, 1);
    run(world, 0.5, () => cuddleTouch(world, actor, { kind: 'scratch', zone: 'head', x: actor.x + 40 }));
    expect(actor.cuddle?.reaction?.kind).toBe('scratch');
    expect(Math.abs(actor.pose.headRot)).toBeGreaterThan(0.1);
    expect(actor.pose.squint).toBeGreaterThan(0.8);
  });

  it('exits by mode with a content hold when petting just happened', () => {
    const { world, actor } = settled();
    run(world, 1, () => cuddleTouch(world, actor, { kind: 'move', zone: 'back', x: actor.x }));
    endCuddle(actor);
    expect(phaseOf(actor)).toBe('hold');
    run(world, 1);
    expect(actor.task.type).toBe('cuddle');
    run(world, 1);
    expect(actor.task.type).toBe('idle');
    expect(takeCuddleOut(actor)).toEqual([expect.objectContaining({ type: 'done' })]);
  });
});

function playSession(breedId: string, ageDays: number) {
  const { world, actor } = setup(breedId, ageDays, { x: 120, y: 560 }, 1);
  startUserTask(world, actor, 'cuddle');
  const phases: string[] = [];
  const out: CuddleOut[] = [];
  let previous = { ...actor.pose };
  let worstDelta = 0;
  let headTurnWhileMoving = 0;
  let headTurnAtLeave = 1;
  let guard = 0;
  while (actor.task.type === 'cuddle' && guard < 60 * 400) {
    guard += 1;
    const phase = phaseOf(actor);
    if (phase && phases[phases.length - 1] !== phase) {
      phases.push(phase);
      if (phase === 'leave') {
        headTurnAtLeave = actor.pose.headTurn;
      }
    }
    if (phase === 'waiting' || phase === 'belly' || phase === 'rollDown' || phase === 'rollOver') {
      if (guard % 6 === 0) {
        cuddleTouch(world, actor, {
          kind: guard % 12 === 0 ? 'stroke' : 'move',
          zone: phase === 'belly' ? 'belly' : 'back',
          x: actor.x + Math.sin(guard / 20) * 50,
        });
      }
    }
    update(world, dt);
    takeSounds(world);
    out.push(...takeCuddleOut(actor));
    worstDelta = Math.max(worstDelta, channelDelta(previous, actor.pose));
    previous = { ...actor.pose };
    if (actor.speed > 14) {
      headTurnWhileMoving = Math.max(headTurnWhileMoving, actor.pose.headTurn);
    }
  }
  return { actor, phases, out, worstDelta, headTurnWhileMoving, headTurnAtLeave, guard };
}

describe('cuddle sessions for every breed and life stage', () => {
  for (const breedId of breedIds) {
    it(`${breedId} cuddles through to its exit smoothly`, () => {
      for (const age of ages) {
        const result = playSession(breedId, age);
        expect(result.guard).toBeLessThan(60 * 400);
        expect(result.actor.task.type).toBe('idle');
        expect(result.phases.slice(0, 3)).toEqual(['approach', 'settle', 'waiting']);
        expect(result.phases).toContain('leave');
        expect(result.out.some((o) => o.type === 'exit' && o.reason === 'tolerance')).toBe(true);
        expect(result.out[result.out.length - 1]).toEqual(expect.objectContaining({ type: 'done' }));
        // headTurn eases to 0 before the walk starts, and is never 1 while the pet moves.
        expect(result.headTurnAtLeave).toBeLessThan(0.06);
        expect(result.headTurnWhileMoving).toBeLessThanOrEqual(0.16);
        // No pose channel jumps in one frame.
        expect({ breedId, age, worst: result.worstDelta < 0.25 }).toEqual({ breedId, age, worst: true });
        const species = breedsFor('dog').some((b) => b.id === breedId) ? 'dog' : 'cat';
        if (species === 'dog') {
          expect(result.phases).toEqual(expect.arrayContaining(['rollDown', 'rollOver', 'belly', 'rollBack', 'unturn', 'shake']));
        } else {
          expect(result.phases).toContain('swat');
        }
      }
    });
  }
});

describe('cuddle mood bursts', () => {
  function settled(breedId = 'retriever') {
    const ctx = setup(breedId);
    startUserTask(ctx.world, ctx.actor, 'cuddle');
    run(ctx.world, 4);
    return ctx;
  }

  it('pays +5 mood after five seconds of continuous gesturing', () => {
    const { world, actor } = settled();
    setCuddleGesturing(actor, true);
    run(world, 4.9);
    expect(takeMoodPops(actor)).toEqual([]);
    run(world, 0.2);
    expect(takeMoodPops(actor)).toEqual([cuddleMoodGain]);
  });

  it('pays again if the user keeps gesturing', () => {
    const { world, actor } = settled();
    setCuddleGesturing(actor, true);
    run(world, 10.1);
    expect(takeMoodPops(actor)).toEqual([cuddleMoodGain, cuddleMoodGain]);
  });

  it('pays +10 once the pet is in a belly rub', () => {
    const { world, actor } = setup('retriever');
    startUserTask(world, actor, 'cuddle');
    let guard = 0;
    while (phaseOf(actor) !== 'belly' && guard < 60 * 120) {
      guard += 1;
      if (guard % 6 === 0) {
        cuddleTouch(world, actor, { kind: 'move', zone: 'back', x: actor.x });
      }
      update(world, dt);
    }
    expect(phaseOf(actor)).toBe('belly');
    setCuddleGesturing(actor, true);
    run(world, 5.1, (frame) => {
      if (frame % 6 === 0) {
        cuddleTouch(world, actor, { kind: 'move', zone: 'belly', x: actor.x });
      }
    });
    expect(phaseOf(actor)).toBe('belly');
    expect(takeMoodPops(actor)).toEqual([cuddleBellyMoodGain]);
  });

  it('resets the streak when the user lifts', () => {
    const { world, actor } = settled();
    setCuddleGesturing(actor, true);
    run(world, 4);
    setCuddleGesturing(actor, false);
    run(world, 2);
    expect(takeMoodPops(actor)).toEqual([]);
    setCuddleGesturing(actor, true);
    run(world, 4.9);
    expect(takeMoodPops(actor)).toEqual([]);
    run(world, 0.2);
    expect(takeMoodPops(actor)).toEqual([cuddleMoodGain]);
  });

  it('does not count gestures before the pet is ready', () => {
    const { world, actor } = setup('retriever');
    startUserTask(world, actor, 'cuddle');
    setCuddleGesturing(actor, true);
    run(world, 0.4);
    expect(['approach', 'settle']).toContain(phaseOf(actor));
    expect(takeMoodPops(actor)).toEqual([]);
    expect(actor.cuddle?.gestureSec ?? 0).toBe(0);
  });
});

describe('cuddle interruption', () => {
  it('blends back from a roll-over when another action starts, without snapping', () => {
    const { world, actor } = setup('retriever');
    startUserTask(world, actor, 'cuddle');
    let guard = 0;
    while (phaseOf(actor) !== 'belly' && guard < 60 * 120) {
      guard += 1;
      if (guard % 6 === 0) {
        cuddleTouch(world, actor, { kind: 'move', zone: 'back', x: actor.x });
      }
      update(world, dt);
    }
    expect(phaseOf(actor)).toBe('belly');
    run(world, 1);
    expect(actor.pose.belly).toBeGreaterThan(0.9);
    startUserTask(world, actor, 'sit');
    expect(actor.cuddle).toBeNull();
    let previous = { ...actor.pose };
    let worst = 0;
    run(world, 3, () => {
      worst = Math.max(worst, channelDelta(previous, actor.pose));
      previous = { ...actor.pose };
    });
    expect(worst).toBeLessThan(0.2);
    expect(actor.pose.belly).toBeLessThan(0.05);
  });

  it('ends by timeout when nobody touches the pet', () => {
    const { world, actor } = setup('retriever');
    startUserTask(world, actor, 'cuddle');
    run(world, 60);
    expect(actor.task.type).toBe('idle');
    const out = takeCuddleOut(actor);
    expect(out[0]).toEqual({ type: 'exit', reason: 'timeout' });
  });
});
