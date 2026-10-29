// funrun-1 is immutable. Tuning adds a new version; races keep the one they were created with.

export const CONFIG_VERSION = 'funrun-1';

export type RaceClassId = 'beginner' | 'novice' | 'open' | 'expert' | 'championship' | 'veteran';

export type NpcRange = readonly [number, number];

export const funRunConfig = {
  version: CONFIG_VERSION,
  distanceM: 70,
  // 2.8 m/s per tap: about 4 taps/s stays with Beginner. About 5 taps/s holds the cap, so high mood and energy can raise it.
  tapAccel: 2.8,
  topSpeed: 11,
  fadePerSec: 1.3,
  fadeStart: 0.6,
  fadeAmount: 0.15,
  tapCap: 20,
  tapWindowMs: 1000,
  maxMs: 60_000,
  stepHz: 60,
  npcWobble: 0.05,
  npcWobbleMs: 2000,
  // Mood and energy each move the top-speed cap: +5% above 90, −5% below 80, −10% below 70.
  statHigh: 0.9,
  statLow: 0.8,
  statLower: 0.7,
  statHighBoost: 0.05,
  statLowDrop: 0.05,
  statLowerDrop: 0.1,
  npcRanges: {
    beginner: [8.2, 9.4],
    novice: [9.2, 10.2],
    open: [10.0, 11.0],
    expert: [10.6, 11.6],
    championship: [11.0, 12.0],
    veteran: [10.0, 11.0],
  } as const satisfies Record<RaceClassId, NpcRange>,
};

export type FunRunConfig = typeof funRunConfig;

const versions: Record<string, FunRunConfig> = {
  [CONFIG_VERSION]: funRunConfig,
};

export function configFor(version: string): FunRunConfig {
  return versions[version] ?? funRunConfig;
}
