/** Live race tuning. Other players' pets are drawn from their own phone's broadcast state. */
export const raceSyncConfig = {
  /** Broadcasts per second from each phone. */
  syncHz: 10,
  /** Other pets are drawn this far behind the race clock, so there is usually a newer sample to glide toward. */
  interpDelayMs: 240,
  /** Coast this far past the last sample when the next packet is late, so remotes do not hitch. */
  extrapolateMs: 180,
  /** Timer and mini-map React updates per second. The canvas follows the display refresh. */
  uiHz: 10,
  /** No update for this long freezes that pet and shows "Reconnecting". */
  staleMs: 3000,
  /** Samples kept per racer. */
  bufferSize: 12,
};

export type LiveOutcome = 'perfect' | 'good' | 'clip' | 'miss';

/** One racer's state as its own phone simulated it, in race time. */
export type LiveState = {
  entryId: string;
  t: number;
  x: number;
  v: number;
  finishMs: number | null;
  jumpX: number | null;
  airM: number;
  duckX: number | null;
  duckUntilX: number;
  clipAtMs: number | null;
  bonkAtMs: number | null;
  outcomes: LiveOutcome[];
  outcomeMs: number[];
};

export type LiveTrack = { samples: LiveState[]; receivedAt: number };

export type LiveView = LiveState & { stale: boolean };

/** The runner fields every event shares, plus the ones Hurdles and Obstacle Course add. */
export type LiveSource = {
  x: number;
  v: number;
  tMs: number;
  finishMs: number | null;
  jumpX?: number | null;
  jumpAirM?: number;
  duckX?: number | null;
  duckUntilX?: number;
  clipAtMs?: number | null;
  bonkAtMs?: number | null;
  outcomes?: readonly string[];
  outcomeMs?: readonly number[];
};

const outcomeSet = new Set<string>(['perfect', 'good', 'clip', 'miss']);
const maxRaceMs = 300_000;
const maxMeters = 2_000;
const maxOutcomes = 200;

function finite(value: unknown, lo: number, hi: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi ? value : null;
}

function optional(value: unknown, lo: number, hi: number): number | null | undefined {
  if (value == null) return null;
  const n = finite(value, lo, hi);
  return n == null ? undefined : n;
}

export function liveStateOf(entryId: string, runner: LiveSource, airM = 0): LiveState {
  return {
    entryId,
    t: runner.tMs,
    x: runner.x,
    v: runner.v,
    finishMs: runner.finishMs,
    jumpX: runner.jumpX ?? null,
    airM: runner.jumpAirM ?? airM,
    duckX: runner.duckX ?? null,
    duckUntilX: runner.duckUntilX ?? 0,
    clipAtMs: runner.clipAtMs ?? null,
    bonkAtMs: runner.bonkAtMs ?? null,
    outcomes: (runner.outcomes ?? []).filter((o): o is LiveOutcome => outcomeSet.has(o)),
    outcomeMs: [...(runner.outcomeMs ?? [])],
  };
}

/** True when a pose, outcome, or finish changed and the packet should go out even inside the rate limit. */
export function liveChanged(prev: LiveState | null, next: LiveState): boolean {
  if (!prev) return true;
  return (
    (next.finishMs != null && prev.finishMs == null) ||
    next.jumpX !== prev.jumpX ||
    next.airM !== prev.airM ||
    next.duckX !== prev.duckX ||
    next.duckUntilX !== prev.duckUntilX ||
    next.clipAtMs !== prev.clipAtMs ||
    next.bonkAtMs !== prev.bonkAtMs ||
    next.outcomes.length !== prev.outcomes.length
  );
}

/** Drops default / empty fields. Broadcast is unreliable, so current scalars and the full outcome list stay on every packet that has them. */
export function packLiveState(state: LiveState): Record<string, unknown> {
  const row: Record<string, unknown> = { entryId: state.entryId, t: state.t, x: state.x, v: state.v };
  if (state.finishMs != null) row.finishMs = state.finishMs;
  if (state.jumpX != null) row.jumpX = state.jumpX;
  if (state.airM) row.airM = state.airM;
  if (state.duckX != null) row.duckX = state.duckX;
  if (state.duckUntilX) row.duckUntilX = state.duckUntilX;
  if (state.clipAtMs != null) row.clipAtMs = state.clipAtMs;
  if (state.bonkAtMs != null) row.bonkAtMs = state.bonkAtMs;
  if (state.outcomes.length > 0) {
    row.outcomes = state.outcomes;
    row.outcomeMs = state.outcomeMs;
  }
  return row;
}

export function parseLiveState(value: unknown): LiveState | null {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!row || typeof row.entryId !== 'string' || !row.entryId) return null;
  const t = finite(row.t, 0, maxRaceMs);
  const x = finite(row.x, -10, maxMeters);
  const v = finite(row.v, 0, 60);
  const airM = finite(row.airM ?? 0, 0, 50);
  const duckUntilX = finite(row.duckUntilX ?? 0, -10, maxMeters);
  if (t == null || x == null || v == null || airM == null || duckUntilX == null) return null;
  const finishMs = optional(row.finishMs, 0, maxRaceMs);
  const jumpX = optional(row.jumpX, -10, maxMeters);
  const duckX = optional(row.duckX, -10, maxMeters);
  const clipAtMs = optional(row.clipAtMs, 0, maxRaceMs);
  const bonkAtMs = optional(row.bonkAtMs, 0, maxRaceMs);
  if (finishMs === undefined || jumpX === undefined || duckX === undefined || clipAtMs === undefined || bonkAtMs === undefined) {
    return null;
  }
  const outcomes = row.outcomes ?? [];
  const outcomeMs = row.outcomeMs ?? [];
  if (!Array.isArray(outcomes) || !Array.isArray(outcomeMs)) return null;
  if (outcomes.length > maxOutcomes || outcomes.length !== outcomeMs.length) return null;
  if (!outcomes.every((o) => typeof o === 'string' && outcomeSet.has(o))) return null;
  if (!outcomeMs.every((ms) => finite(ms, 0, maxRaceMs) != null)) return null;
  return {
    entryId: row.entryId,
    t,
    x,
    v,
    finishMs,
    jumpX,
    airM,
    duckX,
    duckUntilX,
    clipAtMs,
    bonkAtMs,
    outcomes: outcomes as LiveOutcome[],
    outcomeMs: outcomeMs as number[],
  };
}

/** Adds a sample in race-time order. Out-of-order and repeated samples are kept sorted; duplicates replace. */
export function pushSample(track: LiveTrack | undefined, sample: LiveState, now: number, size = raceSyncConfig.bufferSize): LiveTrack {
  const samples = track ? track.samples.filter((s) => s.t !== sample.t) : [];
  let at = samples.length;
  while (at > 0 && samples[at - 1].t > sample.t) at -= 1;
  samples.splice(at, 0, sample);
  if (samples.length > size) samples.splice(0, samples.length - size);
  return { samples, receivedAt: now };
}

/**
 * Where to draw a racer at `renderMs` of race time (already behind the clock by `interpDelayMs`).
 * Distance and speed glide between samples; jumps, ducks, and outcomes come from the earlier sample.
 * Past the newest sample, coast on that sample's speed for up to `extrapolateMs` (unless they already finished).
 */
export function sampleLive(
  track: LiveTrack | undefined,
  renderMs: number,
  now: number,
  staleMs = raceSyncConfig.staleMs,
  extrapolateMs = raceSyncConfig.extrapolateMs,
): LiveView | null {
  if (!track || track.samples.length === 0) return null;
  const { samples } = track;
  const last = samples[samples.length - 1];
  if (now - track.receivedAt > staleMs) {
    return { ...last, v: 0, stale: true };
  }
  let i = samples.length - 1;
  while (i >= 0 && samples[i].t > renderMs) i -= 1;
  if (i < 0) return { ...samples[0], stale: false };
  const a = samples[i];
  const b = samples[i + 1];
  if (!b) {
    if (a.finishMs != null) return { ...a, stale: false };
    const dt = Math.min(Math.max(0, renderMs - a.t), extrapolateMs);
    return { ...a, t: a.t + dt, x: a.x + a.v * (dt / 1000), stale: false };
  }
  const u = (renderMs - a.t) / (b.t - a.t);
  return { ...a, t: renderMs, x: a.x + (b.x - a.x) * u, v: a.v + (b.v - a.v) * u, stale: false };
}

/** The racer's finish time from its newest sample, if it has crossed the line. */
export function liveFinish(track: LiveTrack | undefined): number | null {
  if (!track) return null;
  for (let i = track.samples.length - 1; i >= 0; i -= 1) {
    const ms = track.samples[i].finishMs;
    if (ms != null) return ms;
  }
  return null;
}
