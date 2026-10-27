export type Attempt = {
  targetCs: number;
  actualCs: number;
};

const MAX_CS = 2_147_483_647;

/** Held time floored to hundredths of a second, capped at a signed 32-bit integer. */
export function heldCentiseconds(startedAt: number, now = Date.now()): number {
  return Math.min(MAX_CS, Math.max(0, Math.floor((now - startedAt) / 10)));
}

const MIN_SECONDS = 5;
const MAX_SECONDS = 15;

export function gapOf(attempt: Attempt): number {
  return Math.abs(attempt.actualCs - attempt.targetCs);
}

/** A closer hold replaces the saved attempt. An equal gap keeps the earlier one. */
export function keepCloser(current: Attempt | null, next: Attempt): Attempt {
  if (!current || gapOf(next) < gapOf(current)) {
    return next;
  }
  return current;
}

/** `roll` is in [0, 1). Whole seconds from 5 through 15. */
export function pickTargetSeconds(roll: number): number {
  const span = MAX_SECONDS - MIN_SECONDS + 1;
  const step = Math.min(span - 1, Math.max(0, Math.floor(roll * span)));
  return MIN_SECONDS + step;
}

export function formatStayTime(centiseconds: number): string {
  return `${(centiseconds / 100).toFixed(2)}s`;
}

/** The shown clock matches the target, to a hundredth of a second. */
export function isExactStay(targetCs: number, actualCs: number): boolean {
  return targetCs === actualCs;
}
