import {
  HURDLES_VERSION,
  createHurdleRunner,
  hurdleCourse,
  hurdlesConfig,
  runHurdles,
  stepHurdleRunner,
  zoneHalfWidth,
  type RaceClassId,
} from '../../../supabase/functions/_shared/race-sim/index.ts';

const version = HURDLES_VERSION;
const seed = 'race-1';
const { firstM, lastM, distanceM, zoneBeforeM, airM } = hurdlesConfig;
const runOut = distanceM - lastM;

function evenGap(classId: RaceClassId): number {
  return (lastM - firstM) / (hurdlesConfig.classes[classId].count - 1);
}

// A player who taps the moment the front paws reach each zone center.
function centerTaps(classId: RaceClassId = 'beginner', courseSeed = seed): number[] {
  const state = createHurdleRunner();
  const centers = hurdleCourse(classId, version, courseSeed).hurdles.map((h) => h - zoneBeforeM);
  const taps: number[] = [];
  while (state.finishMs == null && state.tMs < hurdlesConfig.maxMs) {
    const due = taps.length < centers.length && state.x >= centers[taps.length] ? [state.tMs] : [];
    if (due.length > 0) taps.push(state.tMs);
    stepHurdleRunner(state, due, null, null, classId, version, courseSeed);
  }
  return taps;
}

// Tap time (ms from Go) for a jump at a front-paw position, at a steady speed.
function tapAt(x: number, speed: number): number {
  return Math.round((x / speed) * 1000);
}

describe('hurdles sim', () => {
  it('spaces Beginner and Novice hurdles evenly from the first to the last mark', () => {
    for (const classId of ['beginner', 'novice'] as const) {
      const course = hurdleCourse(classId, version, seed);
      expect(course.hurdles).toHaveLength(hurdlesConfig.classes[classId].count);
      expect(course.hurdles[0]).toBe(firstM);
      expect(course.hurdles[course.hurdles.length - 1]).toBeCloseTo(lastM, 9);
      expect(course.distanceM).toBeCloseTo(distanceM, 9);
      expect(hurdleCourse(classId, version, 'another-race')).toEqual(course);
    }
  });

  it('varies the gaps in the upper classes, never shorter than the even gap or longer than 1.5x', () => {
    for (const classId of ['open', 'veteran', 'expert', 'championship'] as const) {
      const even = evenGap(classId);
      const lengths = new Set<number>();
      for (let r = 0; r < 40; r += 1) {
        const { hurdles, distanceM: length } = hurdleCourse(classId, version, `race-${r}`);
        expect(hurdles).toHaveLength(hurdlesConfig.classes[classId].count);
        expect(hurdles[0]).toBe(firstM);
        for (let i = 1; i < hurdles.length; i += 1) {
          const gap = hurdles[i] - hurdles[i - 1];
          expect(gap).toBeGreaterThanOrEqual(even - 1e-9);
          expect(gap).toBeLessThanOrEqual(even * 1.5 + 1e-9);
        }
        expect(length).toBeCloseTo(hurdles[hurdles.length - 1] + runOut, 9);
        lengths.add(Math.round(length * 1000));
      }
      expect(lengths.size).toBeGreaterThan(30);
    }
  });

  it('lays the same course for every racer in a race', () => {
    expect(hurdleCourse('championship', version, seed)).toEqual(hurdleCourse('championship', version, seed));
    expect(hurdleCourse('championship', version, seed)).not.toEqual(hurdleCourse('championship', version, 'race-2'));
  });

  it('keeps hurdles-2 races on the even 100 m course', () => {
    const course = hurdleCourse('championship', 'hurdles-2', seed);
    expect(course.distanceM).toBe(100);
    expect(course.hurdles[course.hurdles.length - 1]).toBeCloseTo(90, 9);
  });

  it('clears every hurdle with perfect jumps and beats a pet that never jumps', () => {
    const clean = runHurdles(centerTaps(), null, null, 'beginner', version, seed);
    expect(clean.outcomes.every((o) => o === 'perfect')).toBe(true);
    const none = runHurdles([], null, null, 'beginner', version, seed);
    expect(none.outcomes.every((o) => o === 'clip')).toBe(true);
    expect(clean.finishMs).not.toBeNull();
    expect(none.finishMs!).toBeGreaterThan(clean.finishMs! + 2000);
  });

  it('runs a varied Championship course cleanly with perfect jumps', () => {
    const run = runHurdles(centerTaps('championship'), null, null, 'championship', version, seed);
    expect(run.outcomes).toHaveLength(10);
    expect(run.outcomes.every((o) => o === 'perfect')).toBe(true);
    expect(run.finishMs).not.toBeNull();
  });

  it('counts a jump that lands before the hurdle as a clip', () => {
    const speed = hurdlesConfig.classes.beginner.speed;
    const early = runHurdles([tapAt(firstM - airM - 0.5, speed)], null, null, 'beginner', version, seed);
    expect(early.outcomes[0]).toBe('clip');
  });

  it('ignores taps while airborne', () => {
    const speed = hurdlesConfig.classes.beginner.speed;
    const first = tapAt(firstM - zoneBeforeM, speed);
    const run = runHurdles([first, first + 100, first + 200], null, null, 'beginner', version, seed);
    expect(run.jumps).toHaveLength(1);
    expect(run.outcomes[0]).toBe('perfect');
  });

  it('widens the zone with agility, up to 10%', () => {
    const base = zoneHalfWidth('beginner', null, version);
    const agile = zoneHalfWidth('beginner', { energy: 80, mood: 80, stamina: 50, agility: 100, intelligence: 50 }, version);
    expect(agile).toBeCloseTo(base * 1.1, 5);
  });

  it('repeats NPC races from the seed', () => {
    const npc = { classId: 'open' as const, skill: 0.6, seed: 'race:npc-1' };
    const a = runHurdles([], null, npc, 'open', version, seed);
    const b = runHurdles([], null, npc, 'open', version, seed);
    expect(a.finishMs).toBe(b.finishMs);
    expect(a.outcomes).toEqual(b.outcomes);
    expect(a.outcomes).toHaveLength(8);
  });
});
