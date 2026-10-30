import {
  CURVE_POINTS,
  curveAt,
  decideCurve,
  defaultCurve,
  enforceMonotonic,
  knownConfig,
  median,
  nextOffset,
  performanceCurve,
  playerMedians,
  resolveSimSkill,
  shouldLogResult,
  skillForMetric,
  skillSteps,
  stepCurve,
} from '../../../supabase/functions/_shared/race-sim/calibration.ts';
import { replayNpc } from '../../../supabase/functions/_shared/race-sim/replay.ts';

const timeGrid = skillSteps().map((skill) => ({ skill, metric: 20_000 - skill * 10_000 }));
const timeCurve = defaultCurve(timeGrid);

it('stores finish times with the best result at the last point', () => {
  const curve = performanceCurve([9000, 11000, 13000, 15000], 'time');
  expect(curve).toHaveLength(CURVE_POINTS);
  expect(curve[0]).toBe(15000);
  expect(curve[CURVE_POINTS - 1]).toBe(9000);
  expect(curve[10]).toBeGreaterThan(curve[CURVE_POINTS - 1]);
});

it('stores distances with the best result at the last point', () => {
  const curve = performanceCurve([40, 55, 70], 'distance');
  expect(curve[0]).toBe(40);
  expect(curve[CURVE_POINTS - 1]).toBe(70);
});

it('uses one median per player', () => {
  const grouped = playerMedians([
    { playerId: 'a', metric: 10 },
    { playerId: 'a', metric: 30 },
    { playerId: 'a', metric: 20 },
    { playerId: 'b', metric: 5 },
  ]);
  expect(grouped.nRuns).toBe(4);
  expect(grouped.nPlayers).toBe(2);
  expect(grouped.medians.sort((a, b) => a - b)).toEqual([5, 20]);
  expect(median([4, 1, 9])).toBe(4);
});

it('moves each point by at most 5% of its current value', () => {
  const current = timeCurve;
  const target = current.map((value) => value * 0.4);
  const next = stepCurve(current, target);
  next.forEach((value, index) => {
    expect(Math.abs(value - current[index])).toBeLessThanOrEqual(0.05 * Math.abs(current[index]) + 1e-6);
  });
});

it('maps a default-curve skill back to itself', () => {
  for (const skill of [0, 0.25, 0.5, 0.8, 1]) {
    expect(skillForMetric(timeGrid, curveAt(timeCurve, skill), 'time')).toBeCloseTo(skill, 5);
  }
  expect(
    resolveSimSkill({
      spread: 0.37,
      offset: 0,
      status: 'default',
      curve: timeCurve,
      grid: timeGrid,
      kind: 'time',
    }),
  ).toBe(0.37);
  expect(
    resolveSimSkill({
      spread: 0.4,
      offset: 0.02,
      status: 'default',
      curve: timeCurve,
      grid: timeGrid,
      kind: 'time',
    }),
  ).toBeCloseTo(0.42, 5);
});

it('forces a noisy skill line to stay monotonic', () => {
  const smoothed = enforceMonotonic([10, 8, 9, 7], 'time');
  for (let index = 1; index < smoothed.length; index += 1) {
    expect(smoothed[index]).toBeLessThanOrEqual(smoothed[index - 1]);
  }
});

it('holds the offset until 100 solos, then steps toward 33%', () => {
  expect(nextOffset(0, 0.5, 99)).toBe(0);
  expect(nextOffset(0, 0.5, 100)).toBeCloseTo(0.02);
  expect(nextOffset(0, 0.2, 100)).toBeCloseTo(-0.02);
  expect(nextOffset(0, 0.33, 200)).toBe(0);
  expect(nextOffset(0.15, 0.8, 200)).toBe(0.15);
  expect(nextOffset(-0.15, 0.1, 200)).toBe(-0.15);
});

it('stays on the default curve below the data gate and steps once the gate is met', () => {
  const held = decideCurve({
    samples: [1000],
    nRuns: 10,
    nPlayers: 4,
    kind: 'time',
    defaults: timeCurve,
    current: null,
    status: null,
  });
  expect(held.status).toBe('default');
  expect(held.curve).toEqual(timeCurve);

  const active = decideCurve({
    samples: Array.from({ length: 30 }, () => 1000),
    nRuns: 200,
    nPlayers: 30,
    kind: 'time',
    defaults: timeCurve,
    current: timeCurve,
    status: 'default',
  });
  expect(active.status).toBe('active');
  active.curve.forEach((value, index) => {
    expect(Math.abs(value - timeCurve[index])).toBeLessThanOrEqual(0.05 * Math.abs(timeCurve[index]) + 1e-6);
  });
});

it('keeps an active curve through a thin day', () => {
  const custom = timeCurve.map((value) => value - 100);
  const held = decideCurve({
    samples: [1000],
    nRuns: 10,
    nPlayers: 4,
    kind: 'time',
    defaults: timeCurve,
    current: custom,
    status: 'active',
  });
  expect(held.status).toBe('active');
  expect(held.curve).toEqual(custom);
});

it('grades a higher Fun Run skill as a faster finish', () => {
  const race = { event: 'funRun' as const, classId: 'open' as const, seed: 'cal-0', configVersion: 'funrun-2' };
  const slow = replayNpc(race, 'grid', 0).finishMs;
  const fast = replayNpc(race, 'grid', 1).finishMs;
  expect(slow).not.toBeNull();
  expect(fast).toBeLessThan(slow!);
});

it('logs stadium finishes and skips friend games, guests, and DNFs', () => {
  expect(shouldLogResult({ metric: 12000, friend: false, anonymous: false })).toBe(true);
  expect(shouldLogResult({ metric: null, friend: false, anonymous: false })).toBe(false);
  expect(shouldLogResult({ metric: 12000, friend: true, anonymous: false })).toBe(false);
  expect(shouldLogResult({ metric: 12000, friend: false, anonymous: true })).toBe(false);
  expect(knownConfig('funRun', 'funrun-2')).toBe(true);
  expect(knownConfig('funRun', 'funrun-9')).toBe(false);
  expect(knownConfig('obstacle', 'obstacle-7')).toBe(true);
});
