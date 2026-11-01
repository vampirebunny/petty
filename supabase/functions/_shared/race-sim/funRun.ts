import { configFor, type FunRunConfig, type RaceClassId } from './config.ts';
import { hashSeed, mulberry32 } from './rng.ts';

export type Modifiers = {
  energy: number;
  mood: number;
  stamina: number;
  agility: number;
  intelligence: number;
};

export const neutralModifiers: Modifiers = {
  energy: 85,
  mood: 85,
  stamina: 50,
  agility: 50,
  intelligence: 50,
};

/** Energy spent by one race input. The same amount comes off the pet and off the speed used for the rest of the race. */
export const RACE_INPUT_ENERGY = 0.4;

export function takeRaceEnergy(energyLeft: number | null, start: number, inputs: number): number {
  const base = energyLeft == null ? start : energyLeft;
  if (inputs <= 0 || base <= 0) return Math.max(0, base);
  return Math.max(0, base - inputs * RACE_INPUT_ENERGY);
}

export type NpcSpec = {
  classId: RaceClassId;
  skill: number;
  seed: string;
};

export type RunnerState = {
  x: number;
  v: number;
  tMs: number;
  finishMs: number | null;
  accepted: number[];
  /** Energy still left for this pet. Null until the first player step copies the start value. */
  energyLeft: number | null;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function unit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value / 100, 0, 1);
}

function statBand(value: number, config: FunRunConfig): number {
  const stat = unit(value);
  if (stat > config.statHigh) {
    return config.statHighBoost;
  }
  if (stat < config.statLower) {
    return -config.statLowerDrop;
  }
  if (stat < config.statLow) {
    return -config.statLowDrop;
  }
  return 0;
}

// Each of mood and energy shifts the top-speed cap on its own. They stack.
export function speedScale(mods: Modifiers, config: FunRunConfig): number {
  return 1 + statBand(mods.mood, config) + statBand(mods.energy, config);
}

function tapPower(x: number, mods: Modifiers, config: FunRunConfig): number {
  const along = clamp((x / config.distanceM - config.fadeStart) / (1 - config.fadeStart), 0, 1);
  const stamina = unit(mods.stamina);
  return 1 - config.fadeAmount * (1 - stamina) * along;
}

export function npcSpeed(spec: NpcSpec, tMs: number, version: string): number {
  const config = configFor(version);
  const range = config.npcRanges[spec.classId] ?? config.npcRanges.open;
  const base = range[0] + (range[1] - range[0]) * clamp(spec.skill, 0, 1);
  const window = Math.floor(tMs / config.npcWobbleMs);
  const roll = mulberry32(hashSeed(`${spec.seed}:${window}`))();
  return base * (1 + (roll * 2 - 1) * config.npcWobble);
}

export function createRunner(): RunnerState {
  return { x: 0, v: 0, tMs: 0, finishMs: null, accepted: [], energyLeft: null };
}

function acceptTap(state: RunnerState, tMs: number, config: FunRunConfig): boolean {
  const windowStart = tMs - config.tapWindowMs;
  state.accepted = state.accepted.filter((at) => at > windowStart);
  if (state.accepted.length >= config.tapCap) {
    return false;
  }
  state.accepted.push(tMs);
  return true;
}

// One fixed step. Taps are times that fall in this step. NPCs ignore taps and hold their target speed.
export function stepRunner(
  state: RunnerState,
  taps: readonly number[],
  mods: Modifiers,
  npc: NpcSpec | null,
  version: string,
): void {
  if (state.finishMs != null) {
    return;
  }
  const config = configFor(version);
  const dt = 1 / config.stepHz;
  const stepMs = 1000 / config.stepHz;
  const next = state.tMs + stepMs;
  if (npc) {
    state.v = npcSpeed(npc, state.tMs, version);
  } else {
    if (state.energyLeft == null) state.energyLeft = mods.energy;
    const power = tapPower(state.x, mods, config);
    for (const tap of taps) {
      if (tap < state.tMs || tap >= next) {
        continue;
      }
      state.energyLeft = takeRaceEnergy(state.energyLeft, mods.energy, 1);
      const scale = speedScale({ ...mods, energy: state.energyLeft }, config);
      if (acceptTap(state, tap, config)) {
        state.v = Math.min(config.topSpeed * scale, state.v + config.tapAccel * power * scale);
      }
    }
    state.v *= Math.exp(-config.fadePerSec * dt);
    const cap = config.topSpeed * speedScale({ ...mods, energy: state.energyLeft }, config);
    state.v = Math.min(cap, state.v);
  }
  state.x += state.v * dt;
  state.tMs = next;
  if (state.x >= config.distanceM) {
    state.finishMs = state.tMs;
  } else if (state.tMs >= config.maxMs) {
    state.finishMs = null;
    state.tMs = config.maxMs;
  }
}

export function runFunRun(taps: readonly number[], mods: Modifiers, npc: NpcSpec | null, version: string): RunnerState {
  const state = createRunner();
  const config = configFor(version);
  const sorted = [...taps].sort((a, b) => a - b);
  let cursor = 0;
  const limit = config.maxMs * config.stepHz;
  for (let i = 0; i < limit && state.finishMs == null && state.tMs < config.maxMs; i += 1) {
    const next = state.tMs + 1000 / config.stepHz;
    const due: number[] = [];
    while (cursor < sorted.length && sorted[cursor] < next) {
      if (sorted[cursor] >= state.tMs) {
        due.push(sorted[cursor]);
      }
      cursor += 1;
    }
    stepRunner(state, due, mods, npc, version);
  }
  return state;
}
