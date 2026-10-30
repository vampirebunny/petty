// One second per beat: Get ready! (T-4s), 3, 2, 1, then Go! for the first second of the race.
export const countLabels = ['Go!', '1', '2', '3', 'Get ready!'] as const;

export const countdownSpanMs = 4000;

export function countBeat(untilStart: number): number | null {
  if (untilStart <= -1000 || untilStart > countdownSpanMs) return null;
  if (untilStart <= 0) return 0;
  return Math.min(4, Math.ceil(untilStart / 1000));
}

export function countLabelFor(untilStart: number): (typeof countLabels)[number] | null {
  const beat = countBeat(untilStart);
  return beat == null ? null : countLabels[beat];
}

// Taps count only at or after Go!, and never once the race is finished.
// A finger already held down does not fire: callers invoke this on touch start.
export function raceInputOpen(at: number, startsAt: number, finished: boolean): boolean {
  return !finished && at >= startsAt;
}
