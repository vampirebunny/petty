import { configFor, type RaceClassId } from './config.ts';
import {
  diveScore,
  dockDiveConfigFor,
  npcDives,
  runDive,
  type DiveInput,
  type DiveScore,
} from './dockDive.ts';
import { neutralModifiers, runFunRun, type Modifiers } from './funRun.ts';
import { hurdlesConfigFor, runHurdles } from './hurdles.ts';
import { obstacleConfigFor, runObstacle, type ObstacleButton, type ObstacleInput } from './obstacle.ts';

export type RaceEventType = 'funRun' | 'hurdles' | 'dockDive' | 'obstacle';

export type FunRunInputLog = { taps: number[] };
export type HurdlesInputLog = { jumps: number[] };
export type DockDiveInputLog = { attempts: DiveInput[][] };
export type ObstacleInputLog = { inputs: ObstacleInput[] };
export type RaceInputLog = FunRunInputLog | HurdlesInputLog | DockDiveInputLog | ObstacleInputLog;

export type ReplayFinish = {
  finishMs: number | null;
  scoreDm: number | null;
  detail: {
    second_dm: number;
    best_attempt: number;
    attempts_m: number[];
    flops: boolean[];
  } | null;
  /** Accepted Fun Run / Obstacle RUN taps, for bot checks. */
  acceptedTaps: number[];
};

export type ReplayRace = {
  event: RaceEventType;
  classId: RaceClassId;
  seed: string;
  configVersion: string;
};

// Obstacle RUN is tapped for the whole course (up to 140 s), so the caps fit about 40 taps a second.
const MAX_INPUTS = 6000;
const MISMATCH_MS = 100;
const MISMATCH_DM = 1;
const BUTTONS: readonly ObstacleButton[] = ['jump', 'duck', 'run'];

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function isClassId(value: unknown): value is RaceClassId {
  return (
    value === 'beginner' ||
    value === 'novice' ||
    value === 'open' ||
    value === 'expert' ||
    value === 'championship' ||
    value === 'veteran'
  );
}

export function parseModifiers(value: unknown): Modifiers {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!row) return { ...neutralModifiers };
  const num = (key: keyof Modifiers) => {
    const raw = row[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw, 0, 100) : neutralModifiers[key];
  };
  return {
    energy: num('energy'),
    mood: num('mood'),
    stamina: num('stamina'),
    agility: num('agility'),
    intelligence: num('intelligence'),
  };
}

export function sanitizeTimes(raw: unknown, maxMs: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    out.push(clamp(Math.round(item), 0, maxMs));
    if (out.length >= MAX_INPUTS) break;
  }
  out.sort((a, b) => a - b);
  return out;
}

function sanitizeDiveAttempt(raw: unknown, maxMs: number): DiveInput[] {
  if (!Array.isArray(raw)) return [];
  const out: DiveInput[] = [];
  for (const item of raw) {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    if (!row || typeof row.at !== 'number' || !Number.isFinite(row.at)) continue;
    out.push({ at: clamp(Math.round(row.at), 0, maxMs), down: row.down === true });
    if (out.length >= MAX_INPUTS) break;
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

export function sanitizeDiveAttempts(raw: unknown, maxMs: number, count: number): DiveInput[][] {
  const rows = Array.isArray(raw) ? raw : [];
  return Array.from({ length: count }, (_, index) => sanitizeDiveAttempt(rows[index], maxMs));
}

export function sanitizeObstacleInputs(raw: unknown, maxMs: number): ObstacleInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ObstacleInput[] = [];
  for (const item of raw) {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    if (!row || typeof row.tMs !== 'number' || !Number.isFinite(row.tMs)) continue;
    if (row.button !== 'jump' && row.button !== 'duck' && row.button !== 'run') continue;
    if (!BUTTONS.includes(row.button)) continue;
    out.push({ tMs: clamp(Math.round(row.tMs), 0, maxMs), button: row.button });
    if (out.length >= MAX_INPUTS) break;
  }
  out.sort((a, b) => a.tMs - b.tMs);
  return out;
}

export function parseInputLog(event: RaceEventType, value: unknown, version: string): RaceInputLog | null {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!row) return null;
  if (event === 'funRun') {
    return { taps: sanitizeTimes(row.taps, configFor(version).maxMs) };
  }
  if (event === 'hurdles') {
    return { jumps: sanitizeTimes(row.jumps, hurdlesConfigFor(version).maxMs) };
  }
  if (event === 'dockDive') {
    const config = dockDiveConfigFor(version);
    return { attempts: sanitizeDiveAttempts(row.attempts, config.windowMs, config.attempts) };
  }
  if (event === 'obstacle') {
    return { inputs: sanitizeObstacleInputs(row.inputs, obstacleConfigFor(version).maxMs) };
  }
  return null;
}

function diveDetail(results: readonly { distanceM: number; flop: boolean }[], score: DiveScore) {
  return {
    second_dm: Math.round(score.secondM * 10),
    best_attempt: score.bestAttempt,
    attempts_m: results.map((result) => result.distanceM),
    flops: results.map((result) => result.flop),
  };
}

function emptyFinish(): ReplayFinish {
  return { finishMs: null, scoreDm: null, detail: null, acceptedTaps: [] };
}

export function replayPlayer(
  race: ReplayRace,
  mods: Modifiers,
  inputLog: RaceInputLog,
): ReplayFinish {
  const { event, classId, seed, configVersion } = race;
  if (event === 'funRun' && 'taps' in inputLog) {
    const result = runFunRun(inputLog.taps, mods, null, configVersion);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: result.accepted };
  }
  if (event === 'hurdles' && 'jumps' in inputLog) {
    const result = runHurdles(inputLog.jumps, mods, null, classId, configVersion, seed);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: [] };
  }
  if (event === 'dockDive' && 'attempts' in inputLog) {
    const results = inputLog.attempts.map((attempt) => runDive(attempt, mods, classId, configVersion));
    const score = diveScore(results, configVersion);
    return {
      finishMs: score.bestAtMs,
      scoreDm: Math.round(score.bestM * 10),
      detail: diveDetail(results, score),
      acceptedTaps: [],
    };
  }
  if (event === 'obstacle' && 'inputs' in inputLog) {
    const result = runObstacle(inputLog.inputs, mods, null, classId, configVersion, seed);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: result.accepted };
  }
  return emptyFinish();
}

export function replayNpc(
  race: ReplayRace,
  entryId: string,
  skill: number,
): ReplayFinish {
  const { event, classId, seed, configVersion } = race;
  const npcSeed = `${seed}:${entryId}`;
  const npcSkill = clamp(skill, 0, 1);
  if (event === 'funRun') {
    const result = runFunRun([], neutralModifiers, { classId, skill: npcSkill, seed: npcSeed }, configVersion);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: [] };
  }
  if (event === 'hurdles') {
    const npc = { classId, skill: npcSkill, seed: npcSeed };
    const result = runHurdles([], null, npc, classId, configVersion, seed);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: [] };
  }
  if (event === 'dockDive') {
    const results = npcDives({ classId, skill: npcSkill, seed: npcSeed }, configVersion);
    const score = diveScore(results, configVersion);
    return {
      finishMs: score.bestAtMs,
      scoreDm: Math.round(score.bestM * 10),
      detail: diveDetail(results, score),
      acceptedTaps: [],
    };
  }
  if (event === 'obstacle') {
    const npc = { classId, skill: npcSkill, seed: npcSeed };
    const result = runObstacle([], null, npc, classId, configVersion, seed);
    return { finishMs: result.finishMs, scoreDm: null, detail: null, acceptedTaps: [] };
  }
  return emptyFinish();
}

/** Even, sustained taps look bot-like. Log only; no auto penalty. */
export function flagBotLike(acceptedTaps: readonly number[]): boolean {
  if (acceptedTaps.length < 40) return false;
  const gaps: number[] = [];
  for (let i = 1; i < acceptedTaps.length; i += 1) {
    gaps.push(acceptedTaps[i] - acceptedTaps[i - 1]);
  }
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (mean < 40 || mean > 200) return false;
  const variance = gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length;
  return Math.sqrt(variance) < 8;
}

export function finishMismatch(claimedMs: number | null | undefined, replayedMs: number | null): boolean {
  if (claimedMs == null || replayedMs == null) {
    return (claimedMs == null) !== (replayedMs == null);
  }
  return Math.abs(claimedMs - replayedMs) > MISMATCH_MS;
}

export function scoreMismatch(claimedDm: number | null | undefined, replayedDm: number | null): boolean {
  if (claimedDm == null || replayedDm == null) {
    return (claimedDm == null) !== (replayedDm == null) && replayedDm != null;
  }
  return Math.abs(claimedDm - replayedDm) > MISMATCH_DM;
}

export function isReplayEvent(value: unknown): value is RaceEventType {
  return value === 'funRun' || value === 'hurdles' || value === 'dockDive' || value === 'obstacle';
}

export function classIdOf(value: unknown): RaceClassId {
  return isClassId(value) ? value : 'open';
}

export function inputLogBytes(log: RaceInputLog): number {
  return JSON.stringify(log).length;
}

export const REPLAY_MAX_INPUT_BYTES = 200_000;
export const REPLAY_MISMATCH_MS = MISMATCH_MS;
