import { GAP_MIN, HIT_R, PET_X, PX_PER_M, SCROLL_CAP, TOP } from '../content';
import { beginRun, createRun, floorY, metersOf, pointerDown, step } from '../engine';
import { enqueueRun, keepBest, rankThisRun } from '../queue';
import type { BoardRow, QueuedRun } from '../queue';
import type { Item, Run } from '../types';

function playable(seed = 1): Run {
  const run = createRun({ seed, logicalH: 700 });
  run.phase = 'play';
  run.spawnX = 10000;
  return run;
}

function item(run: Run, k: Item['k'], x: number, y: number): Item {
  return { k, x, y, g: null, dy: 0, ph: 0 };
}

describe('paddle paws', () => {
  it('swims up above the pet, down below it, and parks when the finger is level', () => {
    const up = playable();
    const start = up.pet.y;
    pointerDown(up, 1, start - 30);
    step(up, 1 / 30);
    expect(up.pet.vy).toBeLessThan(0);
    expect(up.pet.y).toBeLessThan(start);

    const down = playable();
    pointerDown(down, 1, down.pet.y + 30);
    step(down, 1 / 30);
    expect(down.pet.vy).toBeGreaterThan(0);

    const hold = playable();
    hold.pet.vy = 40;
    const parked = hold.pet.y;
    pointerDown(hold, 1, parked);
    for (let i = 0; i < 30; i += 1) {
      pointerDown(hold, 1, hold.pet.y);
      step(hold, 1 / 30);
    }
    expect(Math.abs(hold.pet.vy)).toBeLessThan(1);
    expect(Math.abs(hold.pet.y - parked)).toBeLessThan(8);
  });

  it('sinks when nothing is held and treats the surface and seabed as safe', () => {
    const drift = playable();
    step(drift, 1 / 30);
    expect(drift.pet.vy).toBeGreaterThan(0);
    expect(drift.pet.vy).toBeLessThan(34);

    const top = playable();
    top.pet.y = TOP;
    top.pet.vy = -400;
    step(top, 1 / 30);
    expect(top.pet.y).toBe(TOP);
    expect(top.pet.vy).toBe(0);

    const bottom = playable();
    const limit = floorY(bottom) - 16;
    bottom.pet.y = limit;
    bottom.pet.vy = 400;
    step(bottom, 1 / 30);
    expect(bottom.pet.y).toBe(limit);
    expect(bottom.pet.vy).toBe(0);
  });

  it('opens with a gate at 540, then spaces the next one and shrinks the gap', () => {
    const run = createRun({ seed: 3, logicalH: 700 });
    beginRun(run);
    expect(run.gates[0]?.x).toBe(540);
    expect(run.gates[0]?.gap).toBe(252);
    run.dist = 400 * PX_PER_M;
    for (let i = 0; i < 20 && run.gates.length < 2; i += 1) {
      step(run, 1 / 30);
    }
    expect(run.gates).toHaveLength(2);
    const [first, next] = run.gates;
    expect(next.gap).toBe(GAP_MIN);
    expect(next.x - first.x).toBeGreaterThanOrEqual(235);
    expect(next.x - first.x).toBeLessThanOrEqual(285);
  });

  it('caps scroll speed and unlocks jellyfish before pufferfish', () => {
    const fast = playable();
    fast.dist = 1000 * PX_PER_M;
    step(fast, 1 / 30);
    expect(fast.speed).toBe(SCROLL_CAP);

    const shallow = createRun({ seed: 1, logicalH: 700, rng: () => 0.5 });
    beginRun(shallow);
    shallow.spawnX = 439;
    step(shallow, 1 / 60);
    expect(shallow.seenHazards.has('jelly')).toBe(false);
    expect(shallow.seenHazards.has('puffer')).toBe(false);

    const reef = createRun({ seed: 1, logicalH: 700, rng: () => 0.5 });
    beginRun(reef);
    reef.dist = 50 * PX_PER_M;
    reef.spawnX = 439;
    step(reef, 1 / 60);
    expect(reef.seenHazards.has('jelly')).toBe(true);
    expect(reef.seenHazards.has('puffer')).toBe(false);

    const deep = createRun({ seed: 1, logicalH: 700, rng: () => 0.1 });
    beginRun(deep);
    deep.dist = 120 * PX_PER_M;
    deep.spawnX = 439;
    step(deep, 1 / 60);
    expect(deep.seenHazards.has('puffer')).toBe(true);
  });

  it('scores each item and lets one shield absorb a single hit', () => {
    const run = playable();
    run.pet.y = 300;
    run.items = [item(run, 'shell', PET_X, 300), item(run, 'pearl', PET_X, 300), item(run, 'chest', PET_X + 30, 300)];
    step(run, 0.001);
    expect(run.score).toBe(1 + 5 + 25);
    expect(run.fx.some((popup) => popup.txt === '+25')).toBe(true);

    const shielded = playable();
    shielded.pet.y = 240;
    shielded.items = [item(shielded, 'shield', PET_X, 240)];
    step(shielded, 1 / 30);
    expect(shielded.pet.shield).toBe(true);
    shielded.gates = [{ x: 90, c: shielded.pet.y + 80, gap: 40, amp: 0, ph: 0, seed: 1 }];
    shielded.pet.inv = 0;
    step(shielded, 1 / 30);
    expect(shielded.phase).toBe('play');
    expect(shielded.pet.shield).toBe(false);
    expect(shielded.pet.inv).toBeGreaterThan(1);
    shielded.pet.inv = 0;
    step(shielded, 1 / 30);
    expect(shielded.phase).toBe('dying');
    expect(HIT_R).toBe(14);
  });

  it('keeps every queued run and ignores a repeated client id', () => {
    const first: QueuedRun = { clientRunId: 'a', score: 4, meters: 10, petId: null };
    const second: QueuedRun = { clientRunId: 'b', score: 9, meters: 12, petId: null };
    const queue = enqueueRun(enqueueRun([], first), second);
    expect(enqueueRun(queue, first)).toHaveLength(2);
    expect(keepBest({ score: 4, meters: 10, farthest: 10 }, { score: 3, meters: 20 }).best).toEqual({
      score: 4,
      meters: 10,
      farthest: 20,
    });
    const rows: BoardRow[] = [{ rank: 1, handle: 'mochi', score: 80, meters: 40, at: '2026-01-01T00:00:00.000Z', mine: false }];
    expect(rankThisRun(rows, 50)).toBe(2);
    expect(rankThisRun(rows, 90)).toBe(1);
    expect(metersOf(playable())).toBe(0);
  });
});
