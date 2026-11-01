import {
  METERS_800_SCALE,
  METERS_800_VERSION,
  coastPastM,
  coastRunner,
  RACE_INPUT_ENERGY,
  RACE_INPUT_HYDRATION,
  conditionOf,
  configFor,
  createRunner,
  neutralModifiers,
  runDiveSeries,
  runFunRun,
  speedScale,
  stepRunner,
} from '../../../supabase/functions/_shared/race-sim/index.ts';
import { testPet } from '../__fixtures__/pets';
import { applyRaceOutcome, applyRaceRewards, spendRaceInput, spendRaceTap } from '../raceRewards';

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
    stepRunner(state, due, { ...neutralModifiers, energy: 100 }, null, 'funrun-1');
    peak = Math.max(peak, state.v);
  }
  expect(peak).toBeGreaterThan(config.topSpeed * 0.95);
});

it('raises or lowers the top-speed cap from mood and energy', () => {
  const older = configFor('funrun-1');
  const base = { ...neutralModifiers };
  expect(speedScale({ ...base, mood: 95, energy: 95 }, older)).toBeCloseTo(1.1);
  expect(speedScale({ ...base, mood: 90, energy: 80 }, older)).toBeCloseTo(1);
  expect(speedScale({ ...base, mood: 75, energy: 85 }, older)).toBeCloseTo(0.95);
  expect(speedScale({ ...base, mood: 65, energy: 69 }, older)).toBeCloseTo(0.8);
  expect(speedScale({ ...base, mood: 91, energy: 70 }, older)).toBeCloseTo(1);

  const config = configFor('funrun-2');
  expect(speedScale({ ...base, mood: 95, energy: 95 }, config)).toBeCloseTo(1.1);
  expect(speedScale({ ...base, mood: 90, energy: 65 }, config)).toBeCloseTo(1);
  expect(speedScale({ ...base, mood: 64, energy: 85 }, config)).toBeCloseTo(0.97);
  expect(speedScale({ ...base, mood: 44, energy: 50 }, config)).toBeCloseTo(0.92);
  expect(speedScale({ ...base, mood: 91, energy: 44 }, config)).toBeCloseTo(1);

  expect(speedScale({ ...base, hydration: 100 }, config)).toBeCloseTo(1);
  expect(speedScale({ ...base, hydration: 64 }, config)).toBeCloseTo(0.97);
  expect(speedScale({ ...base, hydration: 44 }, config)).toBeCloseTo(0.95);
  expect(speedScale({ ...base, mood: 95, energy: 95, hydration: 44 }, config)).toBeCloseTo(1.05);
  expect(speedScale({ ...base, hydration: 79 }, older)).toBeCloseTo(0.95);
  expect(speedScale({ ...base, hydration: 69 }, older)).toBeCloseTo(0.9);
});

it('slows a Fun Run once taps spend energy across a band', () => {
  const taps = Array.from({ length: 40 }, (_, index) => index * 200);
  const slipping = runFunRun(taps, { ...neutralModifiers, mood: 85, energy: 66 }, null, 'funrun-2');
  const steady = runFunRun(taps, { ...neutralModifiers, mood: 85, energy: 100 }, null, 'funrun-2');
  expect(slipping.energyLeft).toBeLessThan(65);
  expect(steady.energyLeft).toBeGreaterThan(65);
  expect(steady.finishMs).toBeLessThan(slipping.finishMs!);
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

it('runs 800 Meters on a track 13 times as long as Fun Run', () => {
  const fun = configFor('funrun-2');
  const long = configFor('meters800-1');
  expect(long.distanceM).toBeCloseTo(fun.distanceM * METERS_800_SCALE);
  expect(long.maxMs).toBe(fun.maxMs * METERS_800_SCALE);
  const tapping = (perSec: number, maxMs: number) =>
    Array.from({ length: Math.floor((maxMs / 1000) * perSec) }, (_, index) => Math.round((index * 1000) / perSec));
  const short = runFunRun(tapping(5, fun.maxMs), neutralModifiers, null, 'funrun-2').finishMs;
  const extended = runFunRun(tapping(5, long.maxMs), neutralModifiers, null, 'meters800-1').finishMs;
  expect(short).not.toBeNull();
  expect(extended).not.toBeNull();
  expect(extended!).toBeGreaterThan(short! * 12);
  expect(extended!).toBeLessThan(short! * 14);
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
  expect(typeof pet.hydration).toBe('number');
  expect(typeof pet.attributes.current.stamina).toBe('number');
  expect(typeof pet.attributes.current.agility).toBe('number');
  expect(typeof pet.attributes.current.intelligence).toBe('number');
});

it('spends energy and hydration per race input and stops at zero', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const once = spendRaceTap(pet);
  expect(once.needs.energy).toBeCloseTo(pet.needs.energy - RACE_INPUT_ENERGY);
  expect(once.hydration).toBeCloseTo(pet.hydration - RACE_INPUT_HYDRATION);
  const dry = spendRaceTap({ ...pet, hydration: 0, needs: { ...pet.needs, energy: 0 } });
  expect(dry.needs.energy).toBe(0);
  expect(dry.hydration).toBe(0);
  expect(spendRaceTap(dry)).toBe(dry);
  const thirsty = spendRaceTap({ ...pet, needs: { ...pet.needs, energy: 0 } });
  expect(thirsty.needs.energy).toBe(0);
  expect(thirsty.hydration).toBeCloseTo(pet.hydration - RACE_INPUT_HYDRATION);
  const scrap = spendRaceTap({ ...pet, needs: { ...pet.needs, energy: 0.5 } });
  expect(scrap.needs.energy).toBeCloseTo(0.3);
  const dust = spendRaceTap({ ...pet, needs: { ...pet.needs, energy: 0.05 } });
  expect(dust.needs.energy).toBe(0);
});

it('applies race rewards once and skips race XP during the tutorial', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const finish = { raceId: 'race-1', event: 'funRun', classId: 'beginner', place: 1, at: now };
  const paid = applyRaceRewards(pet, finish, now);
  expect(paid.appliedRaceIds).toEqual(['race-1']);
  expect(paid.ribbons).toEqual(pet.ribbons);
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
  expect(signed.races?.signup?.raceId).toBe('race-1');
  expect(signed.races?.entered).toBe(true);
  expect(applyRaceRewards(signed, { ...finish, raceId: 'race-1' }, now).races?.signup).toBeNull();
  expect(paid.badges).toContain('off-to-the-races');
  expect(paid.badges).not.toContain('first-win');
  const leftoverWin = applyRaceRewards(
    { ...pet, ribbons: [{ raceId: 'old', event: 'funRun', classId: 'beginner', place: 1, at: now }] },
    { ...finish, raceId: 'race-leftover' },
    now,
  );
  expect(leftoverWin.ribbons).toHaveLength(1);
  expect(leftoverWin.badges).toContain('first-win');
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
  expect(grown.badges).toContain('first-win');
  expect(grown.badges).not.toContain('blue-ribbon');
  expect(grown.badges).toContain('moving-up');
});

it('leaves Moving Up to the level-class events', () => {
  const pet = { ...testPet(4, 'retriever', now, 'Maple', 'pet'), level: 3 };
  const run = applyRaceRewards(pet, { raceId: 'run', event: 'funRun', classId: 'open', place: 2, at: now }, now);
  expect(run.badges).not.toContain('moving-up');
  expect(run.ribbons ?? []).toEqual(pet.ribbons ?? []);
  const hurdles = applyRaceRewards(
    { ...run, ribbons: [{ raceId: 'old-hop', event: 'hurdles', classId: 'novice', place: 2, at: now }] },
    { raceId: 'hop', event: 'hurdles', classId: 'novice', place: 2, at: now },
    now,
  );
  expect(hurdles.ribbons).toHaveLength(1);
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

it('scales Fun Run top speed by condition on funrun-3', () => {
  const rows: [number, number, number, number, number][] = [
    [100, 100, 100, 1, 11],
    [90, 90, 90, 0.995, 10.945],
    [70, 70, 70, 0.955, 10.505],
    [100, 100, 0, 0.88, 9.68],
    [30, 30, 70, 0.803, 8.833],
    [0, 100, 100, 0.8, 8.8],
    [0, 0, 0, 0.5, 5.5],
  ];
  for (const [energy, hydration, mood, condition, cap] of rows) {
    expect(conditionOf(energy, hydration, mood)).toBeCloseTo(condition, 3);
    expect(11 * conditionOf(energy, hydration, mood)).toBeCloseTo(cap, 3);
  }
});

it('spends a run tap and a jump on the condition versions and stops at zero', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const tap = spendRaceInput(pet, 'run', 'funrun-3');
  expect(tap.needs.energy).toBeCloseTo(pet.needs.energy - 0.04);
  expect(tap.hydration).toBeCloseTo(pet.hydration - 0.05);
  const jump = spendRaceInput(pet, 'action', 'hurdles-4');
  expect(jump.needs.energy).toBeCloseTo(pet.needs.energy - 1);
  expect(jump.hydration).toBeCloseTo(pet.hydration - 1.2);
  const empty = { ...pet, hydration: 0, needs: { ...pet.needs, energy: 0 } };
  expect(spendRaceInput(empty, 'run', 'funrun-3')).toBe(empty);
  const dryRun = spendRaceInput({ ...pet, needs: { ...pet.needs, energy: 0 } }, 'action', 'obstacle-8');
  expect(dryRun.needs.energy).toBe(0);
  expect(dryRun.hydration).toBeCloseTo(pet.hydration - 1.2);
});

it('spends a Fun Run tap the 20-per-second cap rejects', () => {
  const burst = Array.from({ length: 25 }, (_, index) => index * 10);
  const full = { ...neutralModifiers, energy: 100, mood: 100, hydration: 100 };
  const raced = runFunRun(burst, full, null, 'funrun-3');
  expect(raced.accepted).toHaveLength(20);
  expect(raced.energyLeft).toBeCloseTo(100 - 25 * 0.04);
  expect(raced.hydrationLeft).toBeCloseTo(100 - 25 * 0.05);
});

it('uses Dock Dive condition after the release and carries it to the next attempt', () => {
  const mods = { energy: 100, mood: 100, hydration: 100, stamina: 0, agility: 50, intelligence: 50 };
  const attempt = [
    { at: 200, down: true },
    { at: 900, down: false },
  ];
  const series = runDiveSeries([attempt, attempt], mods, 'open', 'dockdive-2');
  expect(series.pool.energy).toBeCloseTo(100 - 0.16);
  expect(series.pool.hydration).toBeCloseTo(100 - 0.2);
  expect(series.results[0].distanceM).toBeLessThan(series.results[0].flop ? 2 : 100);
  expect(series.results[1].distanceM).toBeLessThanOrEqual(series.results[0].distanceM);
});

it('changes mood once from the server place, including a DNF and a friend game', () => {
  const pet = testPet(4, 'retriever', now, 'Maple', 'pet');
  const start = pet.needs.happiness;
  const finish = { raceId: 'race-mood', event: 'funRun', classId: 'open', place: 1, at: now };
  const won = applyRaceOutcome(pet, finish, now, { didFinish: true, friends: false });
  expect(won.needs.happiness).toBe(Math.min(100, start + 8));
  expect(applyRaceOutcome(won, finish, now, { didFinish: true, friends: false }).needs.happiness).toBe(won.needs.happiness);
  const dnf = applyRaceOutcome(pet, { ...finish, raceId: 'race-dnf', place: 6 }, now, { didFinish: false, friends: false });
  expect(dnf.needs.happiness).toBe(Math.max(0, start - 5));
  expect(dnf.ribbons ?? []).toEqual(pet.ribbons ?? []);
  expect(dnf.appliedRaceIds).toContain('race-dnf');
  const friend = applyRaceOutcome(pet, { ...finish, raceId: 'race-friend', place: 2 }, now, { didFinish: true, friends: true });
  expect(friend.needs.happiness).toBe(Math.min(100, start + 4));
  expect(friend.ribbons ?? []).toEqual(pet.ribbons ?? []);
});

it('finishes the 800 with a full player and a full NPC within 1% condition', () => {
  const config = configFor(METERS_800_VERSION);
  const full = { ...neutralModifiers, energy: 100, mood: 100, hydration: 100 };
  const player = createRunner();
  const every = 0.04 / 0.044;
  let nextTapAt = 0;
  while (player.finishMs == null && player.tMs < config.maxMs) {
    const due: number[] = [];
    while (nextTapAt <= player.x && nextTapAt < config.distanceM) {
      due.push(player.tMs);
      nextTapAt += every;
    }
    stepRunner(player, due, full, null, METERS_800_VERSION);
  }
  const npc = runFunRun([], full, { classId: 'open', skill: 0.5, seed: 'fade' }, METERS_800_VERSION);
  expect(player.finishMs).not.toBeNull();
  expect(npc.finishMs).not.toBeNull();
  const playerCondition = conditionOf(player.energyLeft ?? 0, player.hydrationLeft ?? 0, 100);
  const npcCondition = conditionOf(npc.energyLeft ?? 0, npc.hydrationLeft ?? 0, 100);
  expect(Math.abs(playerCondition - npcCondition)).toBeLessThan(0.01);
});
