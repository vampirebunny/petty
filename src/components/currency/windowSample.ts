export type WindowSample = { x: number; y: number; width: number; height: number };

export function hasWindowSize(sample: WindowSample): boolean {
  return sample.width >= 1 && sample.height >= 1;
}

// The stage sits under the header, so a window origin of 0,0 is the first Android
// measure, taken before the view is on screen. Skip that sample once. A second
// 0,0 means the view really is at the window origin.
export function acceptStageOrigin(
  sample: WindowSample,
  skippedZero: boolean,
): { ok: boolean; skippedZero: boolean } {
  if (!hasWindowSize(sample)) {
    return { ok: false, skippedZero };
  }
  if (sample.x === 0 && sample.y === 0 && !skippedZero) {
    return { ok: false, skippedZero: true };
  }
  return { ok: true, skippedZero: true };
}

export function usableCoinCenter(coin: { x: number; y: number } | null | undefined): { x: number; y: number } | null {
  if (!coin || (coin.x === 0 && coin.y === 0)) {
    return null;
  }
  return coin;
}
