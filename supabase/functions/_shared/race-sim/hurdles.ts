import type { RaceClassId } from './config.ts';
import type { Modifiers } from './funRun.ts';
import { hashSeed, mulberry32 } from './rng.ts';

// Published versions are immutable. Tuning adds a new version; races keep the one they were created with.
export const HURDLES_VERSION = 'hurdles-3';

type HurdleClass = {
  speed: number;
  count: number;
  halfWidth: number;
  clipMax: number;
  clipMin: number;
  /** Longest gap between hurdles as a multiple of the even gap. 1 (or unset) keeps them evenly spaced. */
  gapSpread?: number;
};

export type HurdlesConfig = {
  version: string;
  /** Course length when the hurdles are evenly spaced. The run-out after the last hurdle is `distanceM - lastM`. */
  distanceM: number;
  firstM: number;
  /** Last hurdle on an even course. Its gap sets the shortest gap a varied course can use. */
  lastM: number;
  /** The zone is centered this far before each hurdle, measured at the front paws. */
  zoneBeforeM: number;
  perfectShare: number;
  airM: number;
  perfectBoost: number;
  perfectBoostMs: number;
  clipSpeed: number;
  clipMs: number;
  recoverMs: number;
  maxMs: number;
  stepHz: number;
  /** Both inside the ±10% modifier cap. */
  agilityZone: number;
  moodSpeed: number;
  npcPerfect: readonly [number, number];
  npcSpeedSpread: readonly [number, number];
  classes: Record<RaceClassId, HurdleClass>;
};

const shared = {
  perfectShare: 0.35,
  perfectBoost: 0.05,
  perfectBoostMs: 500,
  clipSpeed: 0.5,
  clipMs: 700,
  recoverMs: 300,
  maxMs: 60_000,
  stepHz: 60,
  agilityZone: 0.1,
  moodSpeed: 0.03,
  npcPerfect: [0.2, 0.6],
  npcSpeedSpread: [0.97, 1.03],
} as const;

const evenClasses: Record<RaceClassId, HurdleClass> = {
  beginner: { speed: 6, count: 6, halfWidth: 1, clipMax: 0.35, clipMin: 0.1 },
  novice: { speed: 6.75, count: 7, halfWidth: 0.9, clipMax: 0.3, clipMin: 0.08 },
  open: { speed: 7.5, count: 8, halfWidth: 0.8, clipMax: 0.25, clipMin: 0.06 },
  veteran: { speed: 7.5, count: 8, halfWidth: 0.8, clipMax: 0.25, clipMin: 0.06 },
  expert: { speed: 8.25, count: 9, halfWidth: 0.7, clipMax: 0.2, clipMin: 0.05 },
  championship: { speed: 9, count: 10, halfWidth: 0.6, clipMax: 0.15, clipMin: 0.03 },
};

const hurdlesV1: HurdlesConfig = {
  ...shared,
  version: 'hurdles-1',
  distanceM: 80,
  firstM: 12,
  lastM: 72,
  zoneBeforeM: 1.5,
  airM: 3,
  classes: evenClasses,
};

// hurdles-2: longer leaps (4.5 m of air, hurdle at mid-air from the zone center) on a 100 m course,
// so the hurdles sit farther apart and there is ground to run between landing and the next zone.
const hurdlesV2: HurdlesConfig = {
  ...shared,
  version: 'hurdles-2',
  distanceM: 100,
  firstM: 15,
  lastM: 90,
  zoneBeforeM: 2.25,
  airM: 4.5,
  classes: evenClasses,
};

// hurdles-3: Open, Veteran, Expert, and Championship draw each gap from the race seed, between the
// hurdles-2 even gap and 1.5x it. The course grows to fit (100 to 137.5 m); the run-out stays 10 m.
export const hurdlesConfig: HurdlesConfig = {
  ...hurdlesV2,
  version: HURDLES_VERSION,
  classes: {
    ...evenClasses,
    open: { ...evenClasses.open, gapSpread: 1.5 },
    veteran: { ...evenClasses.veteran, gapSpread: 1.5 },
    expert: { ...evenClasses.expert, gapSpread: 1.5 },
    championship: { ...evenClasses.championship, gapSpread: 1.5 },
  },
};

const hurdleVersions: Record<string, HurdlesConfig> = {
  'hurdles-1': hurdlesV1,
  'hurdles-2': hurdlesV2,
  [HURDLES_VERSION]: hurdlesConfig,
};

// The server stamps races with the Fun Run version until it stamps a hurdles one; they get the default.
export function hurdlesConfigFor(version: string): HurdlesConfig {
  return hurdleVersions[version] ?? hurdlesConfig;
}

export type HurdleOutcome = 'perfect' | 'good' | 'clip';

export type HurdleNpc = {
  classId: RaceClassId;
  skill: number;
  seed: string;
};

export type HurdleRunner = {
  x: number;
  v: number;
  tMs: number;
  finishMs: number | null;
  /** Front-paw position where the current or last jump left the ground. */
  jumpX: number | null;
  /** Jump starts not yet judged against a hurdle. */
  pendingJumpX: number | null;
  next: number;
  outcomes: HurdleOutcome[];
  /** Race time each outcome was decided, so a clipped hurdle can tumble from that moment. */
  outcomeMs: number[];
  clipAtMs: number | null;
  boostUntilMs: number;
  jumps: number[];
};

/** Where the hurdles stand and where the line is. Every racer in a race shares one course. */
export type HurdleCourse = {
  hurdles: number[];
  distanceM: number;
};

type Course = HurdleCourse & {
  config: HurdlesConfig;
  cls: HurdleClass;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function unit(value: number): number {
  return Number.isFinite(value) ? clamp(value / 100, 0, 1) : 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function layCourse(classId: RaceClassId, version: string, seed: string): Course {
  const config = hurdlesConfigFor(version);
  const cls = config.classes[classId] ?? config.classes.open;
  const runOut = config.distanceM - config.lastM;
  if (cls.count <= 1) return { config, cls, hurdles: [config.firstM], distanceM: config.firstM + runOut };
  const even = (config.lastM - config.firstM) / (cls.count - 1);
  const spread = Math.max(1, cls.gapSpread ?? 1);
  const rng = spread > 1 ? mulberry32(hashSeed(`${seed}:hurdle-gaps`)) : null;
  const hurdles = [config.firstM];
  for (let i = 1; i < cls.count; i += 1) {
    const gap = rng ? even * lerp(1, spread, rng()) : even;
    hurdles.push(hurdles[i - 1] + gap);
  }
  return { config, cls, hurdles, distanceM: hurdles[hurdles.length - 1] + runOut };
}

const courseCache = new Map<string, Course>();

// The sim steps every racer 60 times a second, so courses are laid once per race and reused.
function courseFor(classId: RaceClassId, version: string, seed: string): Course {
  const key = `${version}|${classId}|${seed}`;
  let course = courseCache.get(key);
  if (!course) {
    if (courseCache.size > 32) courseCache.clear();
    course = layCourse(classId, version, seed);
    courseCache.set(key, course);
  }
  return course;
}

// `seed` is the race seed, so every racer in the race runs the same course.
export function hurdleCourse(classId: RaceClassId, version: string, seed: string): HurdleCourse {
  const { hurdles, distanceM } = courseFor(classId, version, seed);
  return { hurdles: [...hurdles], distanceM };
}

export function zoneHalfWidth(classId: RaceClassId, mods: Modifiers | null, version: string): number {
  const config = hurdlesConfigFor(version);
  const cls = config.classes[classId] ?? config.classes.open;
  return cls.halfWidth * (1 + (mods ? config.agilityZone * unit(mods.agility) : 0));
}

function runSpeed(course: Course, mods: Modifiers | null, npc: HurdleNpc | null): number {
  if (npc) {
    const roll = mulberry32(hashSeed(`${npc.seed}:speed`))();
    const [lo, hi] = course.config.npcSpeedSpread;
    return course.cls.speed * lerp(lo, hi, roll);
  }
  const mood = mods ? clamp((unit(mods.mood) - 0.5) / 0.5, 0, 1) : 0;
  return course.cls.speed * (1 + course.config.moodSpeed * mood);
}

function boostMs(course: Course, mods: Modifiers | null): number {
  if (!mods) return course.config.perfectBoostMs;
  // Low energy shortens the Perfect boost, down to half below 40.
  const energy = clamp((unit(mods.energy) - 0.4) / 0.4, 0, 1);
  return course.config.perfectBoostMs * lerp(0.5, 1, energy);
}

// Where an NPC leaves the ground for each hurdle, drawn from its own seed. `courseSeed` is the race seed.
export function npcJumpPlan(npc: HurdleNpc, version: string, courseSeed: string): number[] {
  const course = courseFor(npc.classId, version, courseSeed);
  const rng = mulberry32(hashSeed(`${npc.seed}:jumps`));
  const skill = clamp(npc.skill, 0, 1);
  const half = course.cls.halfWidth;
  const clipChance = lerp(course.cls.clipMax, course.cls.clipMin, skill);
  const perfectChance = lerp(course.config.npcPerfect[0], course.config.npcPerfect[1], skill);
  return course.hurdles.map((at) => {
    const center = at - course.config.zoneBeforeM;
    const clip = rng() < clipChance;
    const perfect = rng() < perfectChance;
    const side = rng() < 0.5 ? -1 : 1;
    if (clip) return center - half - 0.6;
    if (perfect) return center + side * half * course.config.perfectShare * 0.5;
    return center + side * half * lerp(course.config.perfectShare + 0.1, 0.9, rng());
  });
}

export function createHurdleRunner(): HurdleRunner {
  return {
    x: 0,
    v: 0,
    tMs: 0,
    finishMs: null,
    jumpX: null,
    pendingJumpX: null,
    next: 0,
    outcomes: [],
    outcomeMs: [],
    clipAtMs: null,
    boostUntilMs: 0,
    jumps: [],
  };
}

export function isAirborne(state: HurdleRunner, version: string): boolean {
  return state.jumpX != null && state.x < state.jumpX + hurdlesConfigFor(version).airM;
}

function speedFactor(state: HurdleRunner, course: Course): number {
  if (state.clipAtMs != null) {
    const since = state.tMs - state.clipAtMs;
    if (since < course.config.clipMs) return course.config.clipSpeed;
    if (since < course.config.clipMs + course.config.recoverMs) {
      return lerp(course.config.clipSpeed, 1, (since - course.config.clipMs) / course.config.recoverMs);
    }
  }
  return state.tMs < state.boostUntilMs ? 1 + course.config.perfectBoost : 1;
}

function judge(state: HurdleRunner, course: Course, half: number, mods: Modifiers | null): void {
  const at = course.hurdles[state.next];
  const center = at - course.config.zoneBeforeM;
  const from = state.pendingJumpX;
  state.pendingJumpX = null;
  let outcome: HurdleOutcome = 'clip';
  if (from != null && Math.abs(from - center) <= half) {
    outcome = Math.abs(from - center) <= half * course.config.perfectShare ? 'perfect' : 'good';
  }
  state.outcomes.push(outcome);
  state.outcomeMs.push(state.tMs);
  state.next += 1;
  if (outcome === 'clip') {
    state.clipAtMs = state.tMs;
    state.boostUntilMs = 0;
    state.jumpX = null;
  } else if (outcome === 'perfect') {
    state.boostUntilMs = state.tMs + boostMs(course, mods);
  }
}

// One fixed step. Jumps are tap times (ms from Go) that fall in this step. NPCs follow their plan.
export function stepHurdleRunner(
  state: HurdleRunner,
  jumps: readonly number[],
  mods: Modifiers | null,
  npc: HurdleNpc | null,
  classId: RaceClassId,
  version: string,
  courseSeed: string,
  plan: readonly number[] | null = null,
): void {
  if (state.finishMs != null) return;
  const course = courseFor(classId, version, courseSeed);
  const config = course.config;
  const stepMs = 1000 / config.stepHz;
  const next = state.tMs + stepMs;
  const half = zoneHalfWidth(classId, npc ? null : mods, version);

  const wantsJump = npc
    ? plan != null && state.next < plan.length && state.pendingJumpX == null && state.x >= plan[state.next]
    : jumps.some((at) => at >= state.tMs && at < next);
  if (wantsJump && !isAirborne(state, version) && state.next < course.hurdles.length) {
    state.jumpX = state.x;
    state.pendingJumpX = state.x;
    state.jumps.push(state.tMs);
  }

  state.v = runSpeed(course, mods, npc) * speedFactor(state, course);
  state.x += state.v * (stepMs / 1000);
  state.tMs = next;

  while (state.next < course.hurdles.length && state.x >= course.hurdles[state.next]) {
    // A jump that already landed before this hurdle was too early.
    if (state.pendingJumpX != null && state.pendingJumpX + config.airM <= course.hurdles[state.next]) {
      state.pendingJumpX = null;
    }
    judge(state, course, half, npc ? null : mods);
  }

  if (state.x >= course.distanceM) {
    state.finishMs = state.tMs;
  } else if (state.tMs >= config.maxMs) {
    state.finishMs = null;
    state.tMs = config.maxMs;
  }
}

export function runHurdles(
  jumps: readonly number[],
  mods: Modifiers | null,
  npc: HurdleNpc | null,
  classId: RaceClassId,
  version: string,
  courseSeed: string,
): HurdleRunner {
  const config = hurdlesConfigFor(version);
  const state = createHurdleRunner();
  const plan = npc ? npcJumpPlan(npc, version, courseSeed) : null;
  const sorted = [...jumps].sort((a, b) => a - b);
  const stepMs = 1000 / config.stepHz;
  let cursor = 0;
  const limit = config.maxMs * config.stepHz;
  for (let i = 0; i < limit && state.finishMs == null && state.tMs < config.maxMs; i += 1) {
    const end = state.tMs + stepMs;
    const due: number[] = [];
    while (cursor < sorted.length && sorted[cursor] < end) {
      if (sorted[cursor] >= state.tMs) due.push(sorted[cursor]);
      cursor += 1;
    }
    stepHurdleRunner(state, due, mods, npc, classId, version, courseSeed, plan);
  }
  return state;
}

export function hurdleStat(outcomes: readonly HurdleOutcome[], total: number): { clean: number; perfect: number; total: number } {
  return {
    clean: outcomes.filter((o) => o !== 'clip').length,
    perfect: outcomes.filter((o) => o === 'perfect').length,
    total,
  };
}
