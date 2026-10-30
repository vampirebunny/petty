import {
  HURDLES_VERSION,
  createHurdleRunner,
  hurdlePositions,
  hurdlesConfig,
  runHurdles,
  stepHurdleRunner,
  zoneHalfWidth,
} from '../../../supabase/functions/_shared/race-sim/index.ts';

const version = HURDLES_VERSION;
const { firstM, lastM, zoneBeforeM, airM } = hurdlesConfig;

// A player who taps the moment the front paws reach each zone center.
function centerTaps(): number[] {
  const state = createHurdleRunner();
  const centers = hurdlePositions('beginner', version).map((h) => h - hurdlesConfig.zoneBeforeM);
  const taps: number[] = [];
  while (state.finishMs == null && state.tMs < hurdlesConfig.maxMs) {
    const due = taps.length < centers.length && state.x >= centers[taps.length] ? [state.tMs] : [];
    if (due.length > 0) taps.push(state.tMs);
    stepHurdleRunner(state, due, null, null, 'beginner', version);
  }
  return taps;
}

// Tap time (ms from Go) for a jump at a front-paw position, at a steady speed.
function tapAt(x: number, speed: number): number {
  return Math.round((x / speed) * 1000);
}

describe('hurdles sim', () => {
  it('spaces Beginner hurdles evenly from the first to the last mark', () => {
    const at = hurdlePositions('beginner', version);
    expect(at).toHaveLength(6);
    expect(at[0]).toBe(firstM);
    expect(at[5]).toBe(lastM);
    expect(hurdlePositions('championship', version)).toHaveLength(10);
  });

  it('clears every hurdle with perfect jumps and beats a pet that never jumps', () => {
    const clean = runHurdles(centerTaps(), null, null, 'beginner', version);
    expect(clean.outcomes.every((o) => o === 'perfect')).toBe(true);
    const none = runHurdles([], null, null, 'beginner', version);
    expect(none.outcomes.every((o) => o === 'clip')).toBe(true);
    expect(clean.finishMs).not.toBeNull();
    expect(none.finishMs!).toBeGreaterThan(clean.finishMs! + 2000);
  });

  it('counts a jump that lands before the hurdle as a clip', () => {
    const speed = hurdlesConfig.classes.beginner.speed;
    const early = runHurdles([tapAt(firstM - airM - 0.5, speed)], null, null, 'beginner', version);
    expect(early.outcomes[0]).toBe('clip');
  });

  it('ignores taps while airborne', () => {
    const speed = hurdlesConfig.classes.beginner.speed;
    const first = tapAt(firstM - zoneBeforeM, speed);
    const run = runHurdles([first, first + 100, first + 200], null, null, 'beginner', version);
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
    const a = runHurdles([], null, npc, 'open', version);
    const b = runHurdles([], null, npc, 'open', version);
    expect(a.finishMs).toBe(b.finishMs);
    expect(a.outcomes).toEqual(b.outcomes);
    expect(a.outcomes).toHaveLength(8);
  });
});
