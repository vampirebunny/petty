import { configFor, createRunner, neutralModifiers, runFunRun, stepRunner } from '../../../supabase/functions/_shared/race-sim/index.ts';
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
