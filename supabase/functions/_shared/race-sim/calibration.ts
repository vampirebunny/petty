import { CONFIG_VERSION, type RaceClassId } from './config.ts';
import { DOCK_DIVE_VERSION } from './dockDive.ts';
import { HURDLES_VERSION } from './hurdles.ts';
import { isObstacleVersion, OBSTACLE_VERSION } from './obstacle.ts';
import type { RaceEventType } from './replay.ts';

export const CURVE_POINTS = 21;
export const WINDOW_DAYS = 14;
export const MIN_RUNS = 200;
export const MIN_PLAYERS = 30;
export const BLEND_PLAYERS = 100;
export const MAX_STEP = 0.05;
export const WIN_WINDOW_DAYS = 7;
export const WIN_TARGET = 0.33;
export const WIN_DEADBAND = 0.05;
export const WIN_STEP = 0.02;
export const OFFSET_LIMIT = 0.15;
export const MIN_SOLOS = 100;
export const SKILL_LO = 0.1;
export const SKILL_HI = 0.9;
export const GRID_SEEDS = ['cal-0', 'cal-1', 'cal-2', 'cal-3'] as const;

export const RACE_CLASSES = ['beginner', 'novice', 'open', 'expert', 'championship', 'veteran'] as const satisfies readonly RaceClassId[];

export type MetricKind = 'time' | 'distance';
export type CalibrationStatus = 'default' | 'active';

export type GridPoint = {
  skill: number;
  metric: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function metricKind(event: RaceEventType): MetricKind {
  return event === 'dockDive' ? 'distance' : 'time';
}

export function playedMetric(
  event: RaceEventType,
  finishMs: number | null,
  scoreDm: number | null,
): { metric: number; kind: MetricKind } | null {
  if (event === 'dockDive') {
    if (scoreDm == null || !Number.isFinite(scoreDm)) return null;
    return { metric: scoreDm, kind: 'distance' };
  }
  if (finishMs == null || !Number.isFinite(finishMs)) return null;
  return { metric: finishMs, kind: 'time' };
}

export function shouldLogResult(input: { metric: number | null; friend: boolean; anonymous: boolean }): boolean {
  return input.metric != null && Number.isFinite(input.metric) && !input.friend && !input.anonymous;
}

export function knownConfig(event: RaceEventType, version: string): boolean {
  if (event === 'funRun') return version === 'funrun-1' || version === CONFIG_VERSION;
  if (event === 'hurdles') return version === 'hurdles-1' || version === 'hurdles-2' || version === HURDLES_VERSION;
  if (event === 'dockDive') return version === DOCK_DIVE_VERSION;
  return isObstacleVersion(version);
}

export function currentCatalog(): { event: RaceEventType; version: string }[] {
  return [
    { event: 'funRun', version: CONFIG_VERSION },
    { event: 'hurdles', version: HURDLES_VERSION },
    { event: 'dockDive', version: DOCK_DIVE_VERSION },
    { event: 'obstacle', version: OBSTACLE_VERSION },
  ];
}

export function isRaceClass(value: unknown): value is RaceClassId {
  return typeof value === 'string' && (RACE_CLASSES as readonly string[]).includes(value);
}

export function skillSteps(): number[] {
  return Array.from({ length: CURVE_POINTS }, (_, index) => index / (CURVE_POINTS - 1));
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('median of an empty list');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo);
}

/** Index 0 is the worst result. Index 20 is the best. */
export function performanceCurve(samples: readonly number[], kind: MetricKind): number[] {
  if (samples.length === 0) {
    throw new Error('curve needs samples');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const curve: number[] = [];
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const performance = index * 5;
    const raw = kind === 'time' ? 100 - performance : performance;
    curve.push(percentile(sorted, raw));
  }
  return curve;
}

export function enforceMonotonic(metrics: readonly number[], kind: MetricKind): number[] {
  const sign = kind === 'time' ? -1 : 1;
  const values = metrics.map((metric) => metric * sign);
  const blocks: { sum: number; count: number }[] = [];
  for (const value of values) {
    blocks.push({ sum: value, count: 1 });
    while (blocks.length >= 2) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.count <= last.sum / last.count) break;
      blocks.splice(blocks.length - 2, 2, { sum: prev.sum + last.sum, count: prev.count + last.count });
    }
  }
  const out: number[] = [];
  for (const block of blocks) {
    const mean = block.sum / block.count;
    for (let index = 0; index < block.count; index += 1) out.push(mean * sign);
  }
  return out;
}

export function blendWeight(nPlayers: number): number {
  return Math.min(1, nPlayers / BLEND_PLAYERS);
}

export function blendCurves(data: readonly number[], defaults: readonly number[], nPlayers: number): number[] {
  const weight = blendWeight(nPlayers);
  return data.map((value, index) => weight * value + (1 - weight) * defaults[index]);
}

export function stepCurve(current: readonly number[], target: readonly number[]): number[] {
  return current.map((value, index) => {
    const delta = target[index] - value;
    const cap = MAX_STEP * Math.abs(value);
    return value + clamp(delta, -cap, cap);
  });
}

export function curveAt(curve: readonly number[], skill: number): number {
  if (curve.length !== CURVE_POINTS) {
    throw new Error('curve must have 21 points');
  }
  const pos = clamp(skill, 0, 1) * (CURVE_POINTS - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(CURVE_POINTS - 1, Math.ceil(pos));
  if (lo === hi) return curve[lo];
  const t = pos - lo;
  return curve[lo] + (curve[hi] - curve[lo]) * t;
}

export function defaultCurve(grid: readonly GridPoint[]): number[] {
  const sorted = [...grid].sort((a, b) => a.skill - b.skill);
  if (sorted.length !== CURVE_POINTS) {
    throw new Error('grid must have 21 steps');
  }
  return sorted.map((point) => point.metric);
}

/** Inverse of the grid. Matches stadium_resolve_npc_skill. */
export function skillForMetric(grid: readonly GridPoint[], metric: number, kind: MetricKind): number {
  if (grid.length === 0) return 0.5;
  const sorted = [...grid].sort((a, b) => a.skill - b.skill);
  const worseOrEqual = (point: GridPoint) => (kind === 'time' ? point.metric >= metric : point.metric <= metric);
  const candidates = sorted.filter(worseOrEqual);
  if (candidates.length === 0) return sorted[0].skill;
  const left = candidates[candidates.length - 1];
  const right = sorted.find((point) => point.skill > left.skill);
  if (!right || right.metric === left.metric) return left.skill;
  const t = (metric - left.metric) / (right.metric - left.metric);
  return left.skill + (right.skill - left.skill) * t;
}

export function resolveSimSkill(input: {
  spread: number;
  offset: number;
  status: CalibrationStatus;
  curve: readonly number[];
  grid: readonly GridPoint[];
  kind: MetricKind;
}): number {
  if (input.status === 'default' && input.offset === 0) return input.spread;
  const adjusted = clamp(input.spread + input.offset, SKILL_LO, SKILL_HI);
  const target = curveAt(input.curve, adjusted);
  return clamp(skillForMetric(input.grid, target, input.kind), 0, 1);
}

export function nextOffset(current: number, winRate: number, solos: number): number {
  const held = clamp(Number.isFinite(current) ? current : 0, -OFFSET_LIMIT, OFFSET_LIMIT);
  if (!Number.isFinite(solos) || solos < MIN_SOLOS) return held;
  const gap = winRate - WIN_TARGET;
  if (gap > WIN_DEADBAND) return clamp(held + WIN_STEP, -OFFSET_LIMIT, OFFSET_LIMIT);
  if (gap < -WIN_DEADBAND) return clamp(held - WIN_STEP, -OFFSET_LIMIT, OFFSET_LIMIT);
  return held;
}

export function playerMedians(rows: readonly { playerId: string; metric: number }[]): {
  medians: number[];
  nRuns: number;
  nPlayers: number;
} {
  const byPlayer = new Map<string, number[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row.metric);
    byPlayer.set(row.playerId, list);
  }
  return {
    medians: [...byPlayer.values()].map((values) => median(values)),
    nRuns: rows.length,
    nPlayers: byPlayer.size,
  };
}

/**
 * Below the gate, a cell stays on its simulated default.
 * A cell that has already gone active holds its curve through a thin day.
 */
export function decideCurve(input: {
  samples: readonly number[];
  nRuns: number;
  nPlayers: number;
  kind: MetricKind;
  defaults: readonly number[];
  current: readonly number[] | null;
  status: CalibrationStatus | null;
}): { curve: number[]; status: CalibrationStatus } {
  const baseStatus = input.status ?? 'default';
  if (input.samples.length === 0 || input.nRuns < MIN_RUNS || input.nPlayers < MIN_PLAYERS) {
    if (baseStatus === 'active' && input.current && input.current.length === CURVE_POINTS) {
      return { curve: [...input.current], status: 'active' };
    }
    return { curve: [...input.defaults], status: 'default' };
  }
  const data = performanceCurve(input.samples, input.kind);
  const target = blendCurves(data, input.defaults, input.nPlayers);
  const base = input.current && input.current.length === CURVE_POINTS ? input.current : input.defaults;
  return { curve: stepCurve(base, target), status: 'active' };
}

export function windowStart(nowMs: number, days: number): string {
  return new Date(nowMs - days * DAY_MS).toISOString();
}
