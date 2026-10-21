export type PointKind = 'energy' | 'tummy' | 'mood' | 'hydration';

export type PointAdd = {
  kind: PointKind;
  x: number;
  y: number;
  amount: number;
};

// Long enough for the previous pop's sound to start, short enough to feel immediate.
export const pointAddGapMs = 280;

// Each add gets its own start time so its chip and sound are not stacked on the previous one.
export function queuePointAdds(
  now: number,
  cursor: number,
  count: number,
  gapMs = pointAddGapMs,
): { times: number[]; cursor: number } {
  if (count <= 0) {
    return { times: [], cursor };
  }
  let at = Math.max(now, cursor);
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    times.push(at);
    at += gapMs;
  }
  return { times, cursor: at };
}
