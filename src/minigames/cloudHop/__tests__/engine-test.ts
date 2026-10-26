import { MIN_CLOUD_W, PTS_PER_M, UNLOCK } from '../content';
import { beginRun, createRun, metersOf, scoreOf, step } from '../engine';
import { generateUntil } from '../generator';
import { keepBest } from '../best';
import type { Bird } from '../types';

function layout(seed: number) {
  const run = createRun({ seed, logicalH: 800, seen: new Set() });
  return run.clouds.map((cloud) => [cloud.type, Math.round(cloud.x), Math.round(cloud.y), Math.round(cloud.w)]);
}

describe('cloud hop', () => {
  it('builds the same clouds from the same seed', () => {
    expect(layout(7)).toEqual(layout(7));
    expect(layout(7)).not.toEqual(layout(8));
  });

  it('scores height at 10 points per meter plus what was collected', () => {
    const run = createRun({ seed: 1, logicalH: 700, seen: new Set() });
    run.bestY = run.startY - PX(3);
    run.pts = 40;
    expect(metersOf(run)).toBe(3);
    expect(scoreOf(run)).toBe(3 * PTS_PER_M + 40);
  });

  it('forces a bouncy cloud once the climb reaches its unlock', () => {
    const run = createRun({ seed: 4, logicalH: 700, seen: new Set() });
    generateUntil(run, UNLOCK.bouncy + 30);
    const bouncy = run.clouds.find((cloud) => cloud.type === 'bouncy');
    expect(bouncy).toBeTruthy();
    expect((run.startY - (bouncy?.y ?? 0)) / 20).toBeGreaterThanOrEqual(UNLOCK.bouncy);
  });

  it('never shrinks a cloud below the minimum width', () => {
    const run = createRun({ seed: 11, logicalH: 700, seen: new Set(), startMeters: 400 });
    generateUntil(run, 500);
    for (const cloud of run.clouds) {
      expect(cloud.w).toBeGreaterThanOrEqual(MIN_CLOUD_W);
    }
  });

  it('lands when the pet falls through a cloud', () => {
    const run = createRun({ seed: 2, logicalH: 700, seen: new Set() });
    beginRun(run);
    const cloud = run.clouds[0];
    run.pet.on = null;
    run.pet.vy = 200;
    run.pet.y = cloud.y - 1;
    run.pet.x = cloud.x;
    step(run, 0.02);
    expect(run.pet.lastCloud).toBe(cloud);
    expect(run.pet.dead).toBe(false);
  });

  it('lets a thief crow take points instead of the run', () => {
    const run = createRun({ seed: 2, logicalH: 700, seen: new Set() });
    beginRun(run);
    run.pts = 250;
    run.birds = [crowAt(run.pet.x, run.pet.y - 18)];
    step(run, 1 / 60);
    expect(run.pts).toBe(150);
    expect(run.pet.dead).toBe(false);
    expect(run.pet.inv).toBeGreaterThan(0);
  });

  it('keeps the higher pending score', () => {
    const low = { score: 10, meters: 1, petName: 'A', durationS: 3 };
    const high = { score: 40, meters: 2, petName: 'A', durationS: 5 };
    expect(keepBest(low, high)).toBe(high);
    expect(keepBest(high, low)).toBe(high);
    expect(keepBest(null, low)).toBe(low);
  });
});

function PX(meters: number): number {
  return meters * 20;
}

function crowAt(x: number, y: number): Bird {
  return {
    kind: 'crow',
    x,
    y,
    vx: 0,
    vy: 0,
    ph: 0,
    announce: false,
    off: 0,
    gap: 0,
    st: 'patrol',
    tm: 0,
    dx: 0,
    dy: 0,
  };
}
