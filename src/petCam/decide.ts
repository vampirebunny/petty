import { gameplayConfig } from '../sim/gameplayConfig';

const hourMs = 3_600_000;
const minuteMs = 60_000;

export function awayQualifies(awayMs: number): boolean {
  return awayMs >= gameplayConfig.petCam.minAwayHours * hourMs;
}

/**
 * The first unseen return of a long enough absence always shows.
 * Later returns show when `roll` is below showChance.
 */
export function decideShow(input: {
  awayMs: number;
  seen: boolean;
  skipped: boolean;
  eligible: boolean;
  roll: number;
}): 'show' | 'hide' {
  if (input.skipped || !input.eligible || !awayQualifies(input.awayMs)) {
    return 'hide';
  }
  if (!input.seen) {
    return 'show';
  }
  return input.roll < gameplayConfig.petCam.showChance ? 'show' : 'hide';
}

/** A seeded moment inside the away window, inset from both ends. */
export function recordedAt(leftAt: number, returnedAt: number, rng: () => number): number | null {
  const { leaveMarginMin, returnMarginMin } = gameplayConfig.petCam;
  const start = leftAt + leaveMarginMin * minuteMs;
  const end = returnedAt - returnMarginMin * minuteMs;
  if (end <= start) {
    return null;
  }
  return start + rng() * (end - start);
}
