import { coastPastM, coastRunner, configFor, createRunner, neutralModifiers, runFunRun, speedScale, stepRunner } from '../../../supabase/functions/_shared/race-sim/index.ts';
import { testPet } from '../__fixtures__/pets';
import { applyRaceRewards } from '../raceRewards';

const now = Date.UTC(2026, 0, 1, 12, 0, 0);

it('repeats a Fun Run finish from the same taps', () => {
  const taps = Array.from({ length: 200 }, (_, index) => index * 140);
  const first = runFunRun(taps, neutralModifiers, null, 'funrun-1');
  const second = runFunRun(taps, neutralModifiers, null, 'funrun-1');
  expect(first.finishMs).toBe(second.finishMs);
  expect(first.finishMs).not.toBeNull();
});

it('holds top speed from a fast tap', () => {
  const config = configFor('funrun-1');
  const state = createRunner();
  const gap = 125;
  let peak = 0;
  for (let step = 0; step < config.stepHz * 3; step += 1) {
    const next = state.tMs + 1000 / config.stepHz;
    const due: number[] = [];
    for (let at = 0; at < config.maxMs; at += gap) {
      if (at >= state.tMs && at < next) due.push(at);
    }
    stepRunner(state, due, neutralModifiers, null, 'funrun-1');
    peak = Math.max(peak, state.v);
  }
  expect(peak).toBeGreaterThan(config.topSpeed * 0.95);
});

it('raises or lowers the top-speed cap from mood and energy', () => {
  const config = configFor('funrun-1');
  const base = { ...neutralModifiers };
  expect(speedScale({ ...base, mood: 95, energy: 95 }, config)).toBeCloseTo(1.1);
  expect(speedScale({ ...base, mood: 90, energy: 80 }, config)).toBeCloseTo(1);
  expect(speedScale({ ...base, mood: 75, energy: 85 }, config)).toBeCloseTo(0.95);
  expect(speedScale({ ...base, mood: 65, energy: 69 }, config)).toBeCloseTo(0.8);
  expect(speedScale({ ...base, mood: 91, energy: 70 }, config)).toBeCloseTo(1);
});

it('runs farther on the same taps when mood and energy are high', () => {
  const taps = Array.from({ length: 30 }, (_, index) => index * 250);
  const high = runFunRun(taps, { ...neutralModifiers, mood: 100, energy: 100 }, null, 'funrun-1');
  const low = runFunRun(taps, { ...neutralModifiers, mood: 50, energy: 50 }, null, 'funrun-1');
  expect(high.x).toBeGreaterThan(low.x * 1.2);
});

it('keeps beginner NPCs near a steady tapper', () => {
  const config = configFor('funrun-1');
  expect(config.npcRanges.beginner[0]).toBeGreaterThanOrEqual(8);
  expect(config.npcRanges.championship[1]).toBeGreaterThan(config.npcRanges.beginner[1]);
});

it('keeps the one Open Fun Run field in reach of a steady tapper', () => {
  const tapping = (perSec: number) => Array.from({ length: 60 * perSec }, (_, index) => Math.round((index * 1000) / perSec));
  const npcMs = (skill: number) => runFunRun([], neutralModifiers, { classId: 'open', skill, seed: `s${skill}` }, 'funrun-2').finishMs!;
  expect(runFunRun(tapping(5), neutralModifiers, null, 'funrun-2').finishMs!).toBeLessThan(npcMs(0.3));
  expect(runFunRun(tapping(8), neutralModifiers, null, 'funrun-2').finishMs!).toBeLessThan(npcMs(0.9));
  const happy = { ...neutralModifiers, mood: 95, energy: 95 };
  expect(runFunRun(tapping(6), happy, null, 'funrun-2').finishMs!).toBeLessThan(npcMs(0.9));
  expect(configFor('funrun-1').npcRanges.open).toEqual([10.0, 11.0]);
});

it('drops taps past 20 in one second', () => {
  const burst = Array.from({ length: 25 }, (_, index) => index * 10);
  const capped = burst.slice(0, 20);
  expect(runFunRun(burst, neutralModifiers, null, 'funrun-1').x).toBe(runFunRun(capped, neutralModifiers, null, 'funrun-1').x);
});

it('reads the pet fields the race snapshot uses', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  expect(typeof pet.needs.energy).toBe('number');
  expect(typeof pet.needs.happiness).toBe('number');
  expect(typeof pet.attributes.current.stamina).toBe('number');
  expect(typeof pet.attributes.current.agility).toBe('number');
  expect(typeof pet.attributes.current.intelligence).toBe('number');
});

it('applies race rewards once and skips race XP during the tutorial', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const finish = { raceId: 'race-1', event: 'funRun', classId: 'beginner', place: 1, at: now };
  const paid = applyRaceRewards(pet, finish, now);
  expect(paid.appliedRaceIds).toEqual(['race-1']);
  expect(paid.ribbons?.[0]).toMatchObject({ place: 1, event: 'funRun' });
  expect(paid.level).toBe(pet.level + 1);
  expect(paid.tutorialSeen).toContain('race');
  expect(paid.races?.entered).toBe(true);
  expect(paid.races?.signup).toBeNull();
  const signed = applyRaceRewards(
    {
      ...pet,
      races: {
        signup: {
          entryId: 'e',
          raceId: 'race-1',
          eventId: 'ev',
          event: 'funRun',
          startsAt: now,
          classId: 'beginner',
          lane: 1,
        },
        entered: false,
      },
    },
    { ...finish, raceId: 'race-signed' },
    now,
  );
  expect(signed.races?.signup).toBeNull();
  expect(signed.races?.entered).toBe(true);
  expect(paid.badges).toContain('off-to-the-races');
  expect(applyRaceRewards(paid, finish, now)).toBe(paid);

  const grown = applyRaceRewards(
    {
      ...pet,
      level: 12,
      id: 'older',
      badges: ['welcome-home', 'off-to-the-races', 'blue-ribbon', 'moving-up'],
    },
    { ...finish, raceId: 'race-2', classId: 'novice' },
    now,
  );
  expect(grown.xpTotal).toBe(pet.xpTotal + 100);
  expect(grown.badges).toContain('blue-ribbon');
  expect(grown.badges).toContain('moving-up');
});

it('leaves Moving Up to the level-class events', () => {
  const pet = { ...testPet(4, 'retriever', now, 'Maple', 'pet'), level: 3 };
  const run = applyRaceRewards(pet, { raceId: 'run', event: 'funRun', classId: 'open', place: 2, at: now }, now);
  expect(run.badges).not.toContain('moving-up');
  const hurdles = applyRaceRewards(run, { raceId: 'hop', event: 'hurdles', classId: 'novice', place: 2, at: now }, now);
  expect(hurdles.badges).toContain('moving-up');
});

it('coasts finishers past the line without changing the finish time', () => {
  const distanceM = 80;
  const stepMs = 1000 / 60;
  const finished = { x: distanceM, v: 1.5, tMs: 12000, finishMs: 12000 };
  coastRunner(finished, stepMs, distanceM);
  expect(finished.finishMs).toBe(12000);
  expect(finished.v).toBe(4);
  expect(finished.x).toBeCloseTo(distanceM + 4 * (stepMs / 1000), 5);

  const dnf = { x: 40, v: 6, tMs: 60000, finishMs: null as number | null };
  coastRunner(dnf, stepMs, distanceM);
  expect(dnf.x).toBe(40);
  expect(dnf.tMs).toBe(60000);

  const gone = { x: distanceM + coastPastM + 1, v: 9, tMs: 14000, finishMs: 11000 };
  coastRunner(gone, stepMs, distanceM);
  expect(gone.x).toBe(distanceM + coastPastM + 1);
  expect(gone.tMs).toBe(14000);
  expect(gone.finishMs).toBe(11000);
});
