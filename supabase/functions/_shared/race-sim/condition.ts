import type { Modifiers } from './funRun.ts';

export const ENERGY_WEIGHT = 0.2;
export const HYDRATION_WEIGHT = 0.18;
export const MOOD_WEIGHT = 0.12;

export const RUN_ENERGY = 0.04;
export const RUN_HYDRATION = 0.05;
export const ACTION_ENERGY = 1;
export const ACTION_HYDRATION = 1.2;

export const LEGACY_ENERGY = 0.2;
export const LEGACY_HYDRATION = 0.3;

export const NPC_ENERGY_PER_METER = 0.044;
export const NPC_HYDRATION_PER_METER = 0.055;

const CONDITION_VERSIONS = new Set(['funrun-3', 'meters800-2', 'hurdles-4', 'obstacle-8', 'dockdive-2']);

export type RaceInputKind = 'run' | 'action';

export type MeterRates = {
  energyPerMeter: number;
  hydrationPerMeter: number;
};

export type DrainPool = {
  energy: number;
  hydration: number;
  mood: number;
};

export function usesCondition(version: string): boolean {
  return CONDITION_VERSIONS.has(version);
}

function unitStat(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / 100));
}

/** 1 at 100/100/100, 0.5 at 0/0/0. Stats are clamped to 0–100 first. */
export function conditionOf(energy: number, hydration: number, mood: number): number {
  const penalty = (stat: number, weight: number) => {
    const short = 1 - unitStat(stat);
    return weight * short * short;
  };
  return (
    1 -
    penalty(energy, ENERGY_WEIGHT) -
    penalty(hydration, HYDRATION_WEIGHT) -
    penalty(mood, MOOD_WEIGHT)
  );
}

export function inputCost(version: string, kind: RaceInputKind): { energy: number; hydration: number } {
  if (!usesCondition(version)) return { energy: LEGACY_ENERGY, hydration: LEGACY_HYDRATION };
  if (kind === 'action') return { energy: ACTION_ENERGY, hydration: ACTION_HYDRATION };
  return { energy: RUN_ENERGY, hydration: RUN_HYDRATION };
}

export function meterRates(version: string, stamped: Partial<MeterRates> | null | undefined): MeterRates {
  if (!usesCondition(version)) return { energyPerMeter: 0, hydrationPerMeter: 0 };
  const energy = stamped?.energyPerMeter;
  const hydration = stamped?.hydrationPerMeter;
  return {
    energyPerMeter: energy != null && Number.isFinite(energy) ? energy : NPC_ENERGY_PER_METER,
    hydrationPerMeter: hydration != null && Number.isFinite(hydration) ? hydration : NPC_HYDRATION_PER_METER,
  };
}

export function drainPool(mods: Modifiers | null, version: string, npc: boolean): DrainPool {
  if (npc && usesCondition(version)) return { energy: 100, hydration: 100, mood: 100 };
  return {
    energy: mods?.energy ?? 0,
    hydration: mods?.hydration ?? 0,
    mood: mods?.mood ?? 0,
  };
}

export function spendPool(pool: DrainPool, version: string, kind: RaceInputKind, times = 1): void {
  if (times <= 0) return;
  const cost = inputCost(version, kind);
  pool.energy = Math.max(0, pool.energy - times * cost.energy);
  pool.hydration = Math.max(0, pool.hydration - times * cost.hydration);
}

/** Calibration replay. New versions start full. Older versions stay on the flat band at 85. */
export function baselineModifiers(version: string): Modifiers {
  const full = usesCondition(version);
  return {
    energy: full ? 100 : 85,
    mood: full ? 100 : 85,
    hydration: full ? 100 : 85,
    stamina: 50,
    agility: 50,
    intelligence: 50,
  };
}
