// Published versions are immutable. Tuning adds a new version; races keep the one they were created with.

export const CONFIG_VERSION = 'funrun-3';

export type RaceClassId = 'beginner' | 'novice' | 'open' | 'expert' | 'championship' | 'veteran';

export type NpcRange = readonly [number, number];

const funRunV1 = {
  version: 'funrun-1',
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
  // Hydration has no boost: −5% below 80, −10% below 70.
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
  } satisfies Record<RaceClassId, NpcRange> as Record<RaceClassId, NpcRange>,
};

export type FunRunConfig = typeof funRunV1;

// funrun-2: Fun Run is one Open field for every level. NPCs start at full speed, so Open sits near the
// old Beginner range: 4.5 taps/s beats the slowest, 5 places about third, and the fastest takes
// 8 taps/s, or 6 with mood and energy above 90.
const funRunV2: FunRunConfig = {
  ...funRunV1,
  version: 'funrun-2',
  npcRanges: { ...funRunV1.npcRanges, open: [8.2, 9.6] },
  // Each of mood and energy: +5% above 90, no change from 65 through 90, −3% below 65, −5% below 45.
  // Hydration has no boost: no change at 65 and above, −3% below 65, −5% below 45.
  statHigh: 0.9,
  statLow: 0.65,
  statLower: 0.45,
  statHighBoost: 0.05,
  statLowDrop: 0.03,
  statLowerDrop: 0.05,
};

// funrun-3: one condition multiplier instead of the bands. NPC ranges drop by 1/1.1 because a full
// pet no longer gets the old +10% from mood and energy both sitting above 90.
const npcScale = 1 / 1.1;

function scaleRanges(ranges: FunRunConfig['npcRanges']): FunRunConfig['npcRanges'] {
  const scaled = {} as Record<RaceClassId, NpcRange>;
  for (const classId of Object.keys(ranges) as RaceClassId[]) {
    const range = ranges[classId];
    scaled[classId] = [range[0] * npcScale, range[1] * npcScale];
  }
  return scaled;
}

export const funRunConfig: FunRunConfig = {
  ...funRunV2,
  version: CONFIG_VERSION,
  npcRanges: scaleRanges(funRunV2.npcRanges),
};

// 800 Meters is the same Open Fun Run field on a track 13 times as long.
// The time limit scales with the track so a pet who can finish Fun Run can finish this too.
export const METERS_800_SCALE = 13;
export const METERS_800_VERSION = 'meters800-2';

const meters800V1: FunRunConfig = {
  ...funRunV2,
  version: 'meters800-1',
  distanceM: funRunV2.distanceM * METERS_800_SCALE,
  maxMs: funRunV2.maxMs * METERS_800_SCALE,
};

export const meters800Config: FunRunConfig = {
  ...funRunConfig,
  version: METERS_800_VERSION,
  distanceM: funRunConfig.distanceM * METERS_800_SCALE,
  maxMs: funRunConfig.maxMs * METERS_800_SCALE,
};

const versions: Record<string, FunRunConfig> = {
  'funrun-1': funRunV1,
  'funrun-2': funRunV2,
  [CONFIG_VERSION]: funRunConfig,
  'meters800-1': meters800V1,
  [METERS_800_VERSION]: meters800Config,
};

export function configFor(version: string): FunRunConfig {
  return versions[version] ?? funRunV2;
}
