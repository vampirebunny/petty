import type { RaceClassId } from './config.ts';
import type { Modifiers } from './funRun.ts';
import { hashSeed, mulberry32 } from './rng.ts';

// dockdive-1 is immutable. Tuning adds a new version; races keep the one they were created with.
export const DOCK_DIVE_VERSION = 'dockdive-1';

type DiveClass = {
  periodMs: number;
  zoneM: number;
  dockM: number;
  npcMean: readonly [number, number];
};

export const dockDiveConfig = {
  version: DOCK_DIVE_VERSION,
  attempts: 3,
  // Each attempt window, then a 3-2-1 before the next GO.
  windowMs: 6000,
  countdownMs: 3000,
  stepHz: 60,
  topSpeed: 7,
  accelMs: 1500,
  minHoldMs: 200,
  baseM: 2,
  powerM: 6,
  powerExp: 1.3,
  spotEdge: 1,
  spotZoneStart: 0.6,
  spotFloor: 0.4,
  flopM: 1,
  // Inside the ±10% modifier cap: each adds up to 5% to the distance.
  staminaBonus: 0.05,
  moodBonus: 0.05,
  airS: [0.8, 1.3] as const,
  flopAirS: 0.45,
  npcSpreadM: 0.6,
  npcFlop: 0.1,
  // An NPC releases this long before the edge, at most.
  npcLeadMs: 260,
  classes: {
    beginner: { periodMs: 1400, zoneM: 2, dockM: 12, npcMean: [3.5, 5.5] },
    novice: { periodMs: 1250, zoneM: 1.8, dockM: 12, npcMean: [4, 6] },
    open: { periodMs: 1100, zoneM: 1.6, dockM: 12, npcMean: [4.5, 6.5] },
    veteran: { periodMs: 1100, zoneM: 1.6, dockM: 12, npcMean: [4.5, 6.5] },
    expert: { periodMs: 950, zoneM: 1.4, dockM: 12, npcMean: [5, 7] },
    championship: { periodMs: 800, zoneM: 1.2, dockM: 12, npcMean: [5.5, 7.5] },
  } as const satisfies Record<RaceClassId, DiveClass>,
};

export type DockDiveConfig = typeof dockDiveConfig;

const diveVersions: Record<string, DockDiveConfig> = {
  [DOCK_DIVE_VERSION]: dockDiveConfig,
};

// Races created before the server stamped dockdive-1 carry the Fun Run version; they get the default.
export function dockDiveConfigFor(version: string): DockDiveConfig {
  return diveVersions[version] ?? dockDiveConfig;
}

export function diveClass(classId: RaceClassId, version: string): DiveClass {
  const config = dockDiveConfigFor(version);
  return config.classes[classId] ?? config.classes.open;
}

/** A finger going down or up, in ms from that attempt's GO. */
export type DiveInput = { at: number; down: boolean };

export type DiveResult = {
  distanceM: number;
  flop: boolean;
  /** Ms from that attempt's GO when the pet left the dock (release, or the edge on a flop). */
  takeoffMs: number;
  power: number;
  spot: number;
};

export type DiveState = {
  tMs: number;
  x: number;
  v: number;
  holdFromMs: number | null;
  result: DiveResult | null;
};

export type DiveNpc = { classId: RaceClassId; skill: number; seed: string };

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value / 100, 0, 1) : 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function attemptGoMs(index: number, version: string): number {
  const config = dockDiveConfigFor(version);
  return index * (config.windowMs + config.countdownMs);
}

/** Ms from the race start until the last attempt window closes. */
export function diveTotalMs(version: string): number {
  const config = dockDiveConfigFor(version);
  return attemptGoMs(config.attempts - 1, version) + config.windowMs;
}

// The run-up is fixed: every pet, every attempt. Stamina never moves the edge.
export function runUp(tMs: number, version: string): { x: number; v: number } {
  const config = dockDiveConfigFor(version);
  const t = Math.max(0, tMs) / 1000;
  const accel = config.accelMs / 1000;
  if (t <= accel) {
    return { x: (0.5 * config.topSpeed * t * t) / accel, v: (config.topSpeed * t) / accel };
  }
  return { x: 0.5 * config.topSpeed * accel + config.topSpeed * (t - accel), v: config.topSpeed };
}

/** First fixed step at which the pet reaches the dock edge. */
export function edgeMs(classId: RaceClassId, version: string): number {
  const config = dockDiveConfigFor(version);
  const dock = diveClass(classId, version).dockM;
  const stepMs = 1000 / config.stepHz;
  let i = 0;
  while (runUp(i * stepMs, version).x < dock) i += 1;
  return i * stepMs;
}

// Eased 0 → 1 → 0, starting at 0 and peaking half a period into the hold.
export function meterAt(heldMs: number, classId: RaceClassId, version: string): number {
  const period = diveClass(classId, version).periodMs;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, heldMs)) / period);
}

// 1.0 at the edge, 0.6 at the start of the edge zone, the same slope on down to a 0.4 floor.
export function spotAt(x: number, classId: RaceClassId, version: string): number {
  const config = dockDiveConfigFor(version);
  const cls = diveClass(classId, version);
  const before = Math.max(0, cls.dockM - x);
  const slope = (config.spotEdge - config.spotZoneStart) / cls.zoneM;
  return Math.max(config.spotFloor, config.spotEdge - slope * before);
}

export function diveBonus(mods: Modifiers | null, version: string): number {
  if (!mods) return 1;
  const config = dockDiveConfigFor(version);
  const mood = clamp((unit(mods.mood) - 0.5) / 0.5, 0, 1);
  return 1 + config.staminaBonus * unit(mods.stamina) + config.moodBonus * mood;
}

export function diveDistance(power: number, spot: number, mods: Modifiers | null, version: string): number {
  const config = dockDiveConfigFor(version);
  const raw = config.baseM + config.powerM * Math.pow(clamp(power, 0, 1), config.powerExp) * spot;
  return tenth(raw * diveBonus(mods, version));
}

export function createDive(): DiveState {
  return { tMs: 0, x: 0, v: 0, holdFromMs: null, result: null };
}

// One fixed step. Inputs are the ones that fall in this step, applied at its start.
export function stepDive(
  state: DiveState,
  inputs: readonly DiveInput[],
  mods: Modifiers | null,
  classId: RaceClassId,
  version: string,
): void {
  if (state.result) return;
  const config = dockDiveConfigFor(version);
  const cls = diveClass(classId, version);
  const stepMs = 1000 / config.stepHz;
  const here = runUp(state.tMs, version);
  state.x = here.x;
  state.v = here.v;
  if (state.x >= cls.dockM) {
    state.result = { distanceM: config.flopM, flop: true, takeoffMs: state.tMs, power: 0, spot: 0 };
    return;
  }
  for (const input of inputs) {
    if (input.down) {
      if (state.holdFromMs == null) state.holdFromMs = state.tMs;
      continue;
    }
    if (state.holdFromMs == null) continue;
    const held = state.tMs - state.holdFromMs;
    state.holdFromMs = null;
    if (held < config.minHoldMs) continue;
    const power = meterAt(held, classId, version);
    const spot = spotAt(state.x, classId, version);
    state.result = { distanceM: diveDistance(power, spot, mods, version), flop: false, takeoffMs: state.tMs, power, spot };
    return;
  }
  state.tMs += stepMs;
}

/** Runs every step that ends by `untilMs` (ms from that attempt's GO), so later inputs still land. */
export function advanceDive(
  state: DiveState,
  inputs: readonly DiveInput[],
  untilMs: number,
  mods: Modifiers | null,
  classId: RaceClassId,
  version: string,
): void {
  const stepMs = 1000 / dockDiveConfigFor(version).stepHz;
  while (!state.result && state.tMs + stepMs <= untilMs) {
    const end = state.tMs + stepMs;
    const due = inputs.filter((input) => input.at >= state.tMs && input.at < end);
    stepDive(state, due, mods, classId, version);
  }
}

export function runDive(inputs: readonly DiveInput[], mods: Modifiers | null, classId: RaceClassId, version: string): DiveResult {
  const state = createDive();
  const sorted = [...inputs].sort((a, b) => a.at - b.at);
  advanceDive(state, sorted, dockDiveConfigFor(version).windowMs, mods, classId, version);
  return state.result ?? { distanceM: 0, flop: false, takeoffMs: dockDiveConfigFor(version).windowMs, power: 0, spot: 0 };
}

// Three jumps drawn from the race seed.
export function npcDives(npc: DiveNpc, version: string): DiveResult[] {
  const config = dockDiveConfigFor(version);
  const cls = diveClass(npc.classId, version);
  const rng = mulberry32(hashSeed(`${npc.seed}:dives`));
  const mean = lerp(cls.npcMean[0], cls.npcMean[1], clamp(npc.skill, 0, 1));
  const edge = edgeMs(npc.classId, version);
  const stepMs = 1000 / config.stepHz;
  const max = tenth(config.baseM + config.powerM);
  return Array.from({ length: config.attempts }, () => {
    const spread = (rng() * 2 - 1) * config.npcSpreadM;
    const flop = rng() < config.npcFlop;
    const lead = Math.round((rng() * config.npcLeadMs) / stepMs) * stepMs;
    if (flop) return { distanceM: config.flopM, flop: true, takeoffMs: edge, power: 0, spot: 0 };
    return { distanceM: clamp(tenth(mean + spread), config.baseM, max), flop: false, takeoffMs: edge - stepMs - lead, power: 1, spot: 1 };
  });
}

export function airSeconds(result: DiveResult, version: string): number {
  const config = dockDiveConfigFor(version);
  if (result.flop) return config.flopAirS;
  const u = clamp((result.distanceM - config.baseM) / config.powerM, 0, 1);
  return lerp(config.airS[0], config.airS[1], u);
}

export type DiveScore = {
  bestM: number;
  secondM: number;
  /** 0-based attempt of the best jump. */
  bestAttempt: number;
  /** Ms from the race start when the best jump left the dock. */
  bestAtMs: number;
};

export function diveScore(results: readonly (DiveResult | null)[], version: string): DiveScore {
  const rows = results.map((result, index) => ({
    m: result?.distanceM ?? 0,
    at: attemptGoMs(index, version) + (result?.takeoffMs ?? dockDiveConfigFor(version).windowMs),
    index,
  }));
  const sorted = [...rows].sort((a, b) => b.m - a.m || a.at - b.at);
  const best = sorted[0] ?? { m: 0, at: diveTotalMs(version), index: 0 };
  return { bestM: best.m, secondM: sorted[1]?.m ?? 0, bestAttempt: best.index, bestAtMs: Math.round(best.at) };
}

// Best distance, then second-best, then who reached the best first.
export function compareDives(a: DiveScore, b: DiveScore): number {
  return b.bestM - a.bestM || b.secondM - a.secondM || a.bestAtMs - b.bestAtMs;
}
