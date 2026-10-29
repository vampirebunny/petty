// funrun-1 is immutable. Tuning adds a new version; races keep the one they were created with.

export const CONFIG_VERSION = 'funrun-1';

export type RaceClassId = 'beginner' | 'novice' | 'open' | 'expert' | 'championship' | 'veteran';

export type NpcRange = readonly [number, number];

export const funRunConfig = {
  version: CONFIG_VERSION,
  distanceM: 70,
  // 2.1 m/s per tap: about 4 taps/s stays with Beginner, and about 8 taps/s holds top speed.
  tapAccel: 2.1,
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
  modifierCap: 0.1,
  moodBoost: 0.05,
  lowEnergy: 0.5,
  npcRanges: {
    beginner: [5.3, 6.1],
    novice: [6.1, 6.9],
    open: [6.9, 7.6],
    expert: [7.6, 8.4],
    championship: [8.4, 9.1],
    veteran: [6.9, 7.6],
  } as const satisfies Record<RaceClassId, NpcRange>,
};

export type FunRunConfig = typeof funRunConfig;

const versions: Record<string, FunRunConfig> = {
  [CONFIG_VERSION]: funRunConfig,
};

export function configFor(version: string): FunRunConfig {
  return versions[version] ?? funRunConfig;
}
