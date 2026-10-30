import {
  finishMismatch,
  flagBotLike,
  neutralModifiers,
  parseInputLog,
  replayNpc,
  replayPlayer,
  runFunRun,
  sanitizeTimes,
  scoreMismatch,
} from '../../../supabase/functions/_shared/race-sim/index.ts';

const race = {
  event: 'funRun' as const,
  classId: 'open' as const,
  seed: 'seed-1',
  configVersion: 'funrun-2',
};

it('sanitizes and sorts tap times', () => {
  expect(sanitizeTimes([300, Number.NaN, -5, 50.7, 50.7], 100)).toEqual([0, 51, 51, 100]);
});

it('parses a Fun Run log and matches runFunRun', () => {
  const taps = Array.from({ length: 120 }, (_, index) => index * 140);
  const log = parseInputLog('funRun', { taps }, 'funrun-2');
  expect(log && 'taps' in log ? log.taps.length : 0).toBe(120);
  const replayed = replayPlayer(race, neutralModifiers, log!);
  expect(replayed.finishMs).toBe(runFunRun(taps, neutralModifiers, null, 'funrun-2').finishMs);
});

it('replays NPCs from the race seed without player taps', () => {
  const first = replayNpc(race, 'npc-a', 0.8);
  const second = replayNpc(race, 'npc-a', 0.8);
  expect(first.finishMs).toBe(second.finishMs);
  expect(first.finishMs).not.toBeNull();
});

it('flags evenly spaced sustained taps', () => {
  const even = Array.from({ length: 50 }, (_, index) => index * 100);
  expect(flagBotLike(even)).toBe(true);
  const human = even.map((at, index) => at + (index % 3) * 17);
  expect(flagBotLike(human)).toBe(false);
  expect(flagBotLike(even.slice(0, 20))).toBe(false);
});

it('detects finish and score mismatches', () => {
  expect(finishMismatch(1000, 1000)).toBe(false);
  expect(finishMismatch(1000, 1101)).toBe(true);
  expect(finishMismatch(null, 1000)).toBe(true);
  expect(scoreMismatch(64, 64)).toBe(false);
  expect(scoreMismatch(64, 66)).toBe(true);
});

it('parses Dock Dive attempts', () => {
  const log = parseInputLog(
    'dockDive',
    {
      attempts: [
        [
          { at: 1000, down: true },
          { at: 1800, down: false },
        ],
        [],
        [{ at: 50, down: true }],
      ],
    },
    'dockdive-1',
  );
  expect(log && 'attempts' in log ? log.attempts.length : 0).toBe(3);
  expect(log && 'attempts' in log ? log.attempts[0].length : 0).toBe(2);
});
