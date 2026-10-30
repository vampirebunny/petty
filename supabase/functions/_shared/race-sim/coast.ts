export const coastFloorMps = 4;
export const coastPastM = 80;

export type CoastState = {
  x: number;
  v: number;
  tMs: number;
  finishMs: number | null;
};

// After the line, keep the crossing speed (at least 4 m/s) until the pet is well past the finish.
// finishMs stays the moment of crossing. A pet that never finishes is left where it stopped.
export function coastRunner(state: CoastState, stepMs: number, distanceM: number): void {
  if (state.finishMs == null) return;
  if (state.x > distanceM + coastPastM) return;
  state.v = Math.max(state.v, coastFloorMps);
  state.x += state.v * (stepMs / 1000);
  state.tMs += stepMs;
}
