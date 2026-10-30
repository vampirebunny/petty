import type { RaceClassId } from './config.ts';
import { npcSpeed, type Modifiers } from './funRun.ts';
import { hashSeed, mulberry32 } from './rng.ts';

// Published versions are immutable. Tuning adds a new version; races keep the one they were created with.
export const OBSTACLE_VERSION = 'obstacle-2';

type ObstacleClass = {
  speed: number;
  hurdles: number;
  tunnels: number;
  sprints: number;
  halfWidth: number;
  /** Clear ground between one section's end and the next section's zone. */
  gapM: number;
  clipMax: number;
  clipMin: number;
};

export type ObstacleConfig = {
  version: string;
  /** Where the first section's zone (or a sprint's start) begins. */
  firstM: number;
  runOutM: number;
  /** Each gap is drawn from the race seed between the class gap and this multiple of it. */
  gapSpread: number;
  /** Extra ground after a sprint, so a thumb can move from RUN to JUMP or DUCK. */
  afterSprintM: number;
  /** Hurdle zone center, measured back from the hurdle at the front paws. */
  zoneBeforeM: number;
  airM: number;
  /** Air distance of the hop a JUMP makes in front of a tunnel. */
  hopM: number;
  tunnelM: number;
  /** Tunnel zone center, measured back from the mouth. */
  tunnelZoneBeforeM: number;
  /** A duck lasts the zone offset plus the zone half-width plus this, so any duck in the zone is low at the mouth. */
  duckPastM: number;
  sprintM: number;
  perfectShare: number;
  perfectBoost: number;
  perfectBoostMs: number;
  clipSpeed: number;
  clipMs: number;
  recoverMs: number;
  /** Speed share while crawling through a tunnel after a bonk. */
  crawlSpeed: number;
  /** Sprint speed fades toward this share of base speed without taps. */
  sprintFloor: number;
  tapAccel: number;
  topSpeed: number;
  fadePerSec: number;
  tapCap: number;
  tapWindowMs: number;
  /** Stamina fade starts this far through a sprint. */
  fadeStart: number;
  fadeAmount: number;
  /** NPC sprint ramp, and the climb back to base after a slow sprint, in m/s². */
  rampMps2: number;
  /** Fun Run version whose class ranges set NPC sprint speed. */
  npcSprintVersion: string;
  maxMs: number;
  stepHz: number;
  /** Both inside the ±10% modifier cap. */
  agilityZone: number;
  moodSpeed: number;
  npcPerfect: readonly [number, number];
  npcSpeedSpread: readonly [number, number];
  classes: Record<RaceClassId, ObstacleClass>;
};

const openClass: ObstacleClass = { speed: 7, hurdles: 3, tunnels: 2, sprints: 2, halfWidth: 0.8, gapM: 7, clipMax: 0.25, clipMin: 0.06 };

const obstacleV1: ObstacleConfig = {
  version: 'obstacle-1',
  firstM: 12,
  runOutM: 10,
  gapSpread: 1.3,
  afterSprintM: 4,
  zoneBeforeM: 2.25,
  airM: 4.5,
  hopM: 1.5,
  tunnelM: 4,
  tunnelZoneBeforeM: 1.2,
  duckPastM: 0.3,
  sprintM: 10,
  perfectShare: 0.35,
  perfectBoost: 0.05,
  perfectBoostMs: 500,
  clipSpeed: 0.5,
  clipMs: 700,
  recoverMs: 300,
  crawlSpeed: 0.6,
  sprintFloor: 0.6,
  tapAccel: 2.8,
  topSpeed: 11,
  fadePerSec: 1.3,
  tapCap: 20,
  tapWindowMs: 1000,
  fadeStart: 0.6,
  fadeAmount: 0.15,
  rampMps2: 6,
  npcSprintVersion: 'funrun-1',
  maxMs: 60_000,
  stepHz: 60,
  agilityZone: 0.1,
  moodSpeed: 0.03,
  npcPerfect: [0.2, 0.6],
  npcSpeedSpread: [0.97, 1.03],
  classes: {
    beginner: { speed: 6, hurdles: 2, tunnels: 1, sprints: 1, halfWidth: 1, gapM: 9, clipMax: 0.35, clipMin: 0.1 },
    novice: { speed: 6.5, hurdles: 3, tunnels: 1, sprints: 1, halfWidth: 0.9, gapM: 8, clipMax: 0.3, clipMin: 0.08 },
    open: openClass,
    veteran: openClass,
    expert: { speed: 7.5, hurdles: 4, tunnels: 2, sprints: 2, halfWidth: 0.7, gapM: 6.5, clipMax: 0.2, clipMin: 0.05 },
    championship: { speed: 8, hurdles: 5, tunnels: 3, sprints: 2, halfWidth: 0.6, gapM: 6, clipMax: 0.15, clipMin: 0.03 },
  },
};

const longOpen: ObstacleClass = { ...openClass, hurdles: 16, tunnels: 10, sprints: 0 };

// obstacle-2: no sprints, and about three times the obstacle-1 course: more hurdles and tunnels at the same
// gaps, 250 to 470 m. Races run 45 to 60 s, so the max race length doubles.
export const obstacleConfig: ObstacleConfig = {
  ...obstacleV1,
  version: OBSTACLE_VERSION,
  maxMs: 120_000,
  classes: {
    beginner: { ...obstacleV1.classes.beginner, hurdles: 10, tunnels: 5, sprints: 0 },
    novice: { ...obstacleV1.classes.novice, hurdles: 12, tunnels: 6, sprints: 0 },
    open: longOpen,
    veteran: longOpen,
    expert: { ...obstacleV1.classes.expert, hurdles: 19, tunnels: 11, sprints: 0 },
    championship: { ...obstacleV1.classes.championship, hurdles: 23, tunnels: 14, sprints: 0 },
  },
};

const obstacleVersions: Record<string, ObstacleConfig> = {
  'obstacle-1': obstacleV1,
  [OBSTACLE_VERSION]: obstacleConfig,
};

export function obstacleConfigFor(version: string): ObstacleConfig {
  return obstacleVersions[version] ?? obstacleConfig;
}

export type SectionKind = 'hurdle' | 'tunnel' | 'sprint';
export type ObstacleButton = 'jump' | 'duck' | 'run';
export type ObstacleOutcome = 'perfect' | 'good' | 'miss';

/**
 * `start` is where the section's zone (or a sprint) begins. `at` is the hurdle, the tunnel mouth, or the
 * sprint start. `end` is the nominal landing, the tunnel exit, or the sprint end. Taps between `at` and
 * `end` belong to that section.
 */
export type CourseSection = { kind: SectionKind; start: number; at: number; end: number };

export type ObstacleCourse = {
  sections: CourseSection[];
  /** Hurdles and tunnels in course order. Outcomes index into this list. */
  obstacles: CourseSection[];
  distanceM: number;
};

export type ObstacleInput = { tMs: number; button: ObstacleButton };

export type ObstacleNpc = {
  classId: RaceClassId;
  skill: number;
  seed: string;
};

export type ObstacleRunner = {
  x: number;
  v: number;
  tMs: number;
  finishMs: number | null;
  /** Running speed before stumbles and boosts. Null until the first step. */
  cruise: number | null;
  next: number;
  outcomes: ObstacleOutcome[];
  outcomeMs: number[];
  /** Where the current or last leap or hop left the ground, and how far it flies. */
  jumpX: number | null;
  jumpAirM: number;
  pendingJumpX: number | null;
  /** Where the current or last duck began, and where the pet stands back up. */
  duckX: number | null;
  duckUntilX: number;
  pendingDuckX: number | null;
  /** A wrong button or an early duck already lost the next obstacle. */
  spoiled: boolean;
  clipAtMs: number | null;
  bonkAtMs: number | null;
  bonkExitX: number;
  bonkOutMs: number | null;
  boostUntilMs: number;
  accepted: number[];
  topTaps: number;
  /** The obstacle an NPC already acted for. */
  acted: number;
  jumps: number[];
  ducks: number[];
};

type Course = ObstacleCourse & {
  config: ObstacleConfig;
  cls: ObstacleClass;
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

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Hurdles and tunnels are shuffled, then each sprint takes a different slot between them, so two sprints never touch.
function sectionOrder(cls: ObstacleClass, rng: () => number): SectionKind[] {
  const obstacles = shuffle<SectionKind>(
    [...Array<SectionKind>(cls.hurdles).fill('hurdle'), ...Array<SectionKind>(cls.tunnels).fill('tunnel')],
    rng,
  );
  const slots = shuffle(
    Array.from({ length: obstacles.length + 1 }, (_, i) => i),
    rng,
  )
    .slice(0, Math.min(cls.sprints, obstacles.length + 1))
    .sort((a, b) => b - a);
  const order = [...obstacles];
  for (const slot of slots) order.splice(slot, 0, 'sprint');
  return order;
}

function layCourse(classId: RaceClassId, version: string, seed: string): Course {
  const config = obstacleConfigFor(version);
  const cls = config.classes[classId] ?? config.classes.open;
  const rng = mulberry32(hashSeed(`${seed}:obstacle-order`));
  const order = sectionOrder(cls, rng);
  const widest = cls.halfWidth * (1 + config.agilityZone);
  const sections: CourseSection[] = [];
  let cursor = config.firstM;
  order.forEach((kind, index) => {
    if (index > 0) {
      cursor += cls.gapM * lerp(1, config.gapSpread, rng());
      if (order[index - 1] === 'sprint') cursor += config.afterSprintM;
    }
    if (kind === 'hurdle') {
      const at = cursor + config.zoneBeforeM + widest;
      sections.push({ kind, start: cursor, at, end: at + config.airM - config.zoneBeforeM });
    } else if (kind === 'tunnel') {
      const at = cursor + config.tunnelZoneBeforeM + widest;
      sections.push({ kind, start: cursor, at, end: at + config.tunnelM });
    } else {
      sections.push({ kind, start: cursor, at: cursor, end: cursor + config.sprintM });
    }
    cursor = sections[sections.length - 1].end;
  });
  return {
    config,
    cls,
    sections,
    obstacles: sections.filter((section) => section.kind !== 'sprint'),
    distanceM: cursor + config.runOutM,
  };
}

const courseCache = new Map<string, Course>();

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
export function obstacleCourse(classId: RaceClassId, version: string, seed: string): ObstacleCourse {
  const { sections, obstacles, distanceM } = courseFor(classId, version, seed);
  return { sections: sections.map((s) => ({ ...s })), obstacles: obstacles.map((s) => ({ ...s })), distanceM };
}

export function obstacleZoneHalfWidth(classId: RaceClassId, mods: Modifiers | null, version: string): number {
  const config = obstacleConfigFor(version);
  const cls = config.classes[classId] ?? config.classes.open;
  return cls.halfWidth * (1 + (mods ? config.agilityZone * unit(mods.agility) : 0));
}

export function zoneCenter(section: CourseSection, version: string): number {
  const config = obstacleConfigFor(version);
  return section.at - (section.kind === 'tunnel' ? config.tunnelZoneBeforeM : config.zoneBeforeM);
}

export function duckLengthM(half: number, version: string): number {
  const config = obstacleConfigFor(version);
  return config.tunnelZoneBeforeM + half + config.duckPastM;
}

function baseSpeed(course: Course, mods: Modifiers | null, npc: ObstacleNpc | null): number {
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
  const energy = clamp((unit(mods.energy) - 0.4) / 0.4, 0, 1);
  return course.config.perfectBoostMs * lerp(0.5, 1, energy);
}

// Where an NPC jumps or ducks for each obstacle, drawn from its own seed. `courseSeed` is the race seed.
export function npcObstaclePlan(npc: ObstacleNpc, version: string, courseSeed: string): number[] {
  const course = courseFor(npc.classId, version, courseSeed);
  const rng = mulberry32(hashSeed(`${npc.seed}:obstacles`));
  const skill = clamp(npc.skill, 0, 1);
  const half = course.cls.halfWidth;
  const share = course.config.perfectShare;
  const missChance = lerp(course.cls.clipMax, course.cls.clipMin, skill);
  const perfectChance = lerp(course.config.npcPerfect[0], course.config.npcPerfect[1], skill);
  return course.obstacles.map((section) => {
    const center = zoneCenter(section, version);
    const miss = rng() < missChance;
    const perfect = rng() < perfectChance;
    const side = rng() < 0.5 ? -1 : 1;
    // Too early: a leap still in the air at the bar, or a duck that stands up before the mouth.
    if (miss) return center - half - 0.6;
    if (perfect) return center + side * half * share * 0.5;
    return center + side * half * lerp(share + 0.1, 0.9, rng());
  });
}

export function createObstacleRunner(): ObstacleRunner {
  return {
    x: 0,
    v: 0,
    tMs: 0,
    finishMs: null,
    cruise: null,
    next: 0,
    outcomes: [],
    outcomeMs: [],
    jumpX: null,
    jumpAirM: 0,
    pendingJumpX: null,
    duckX: null,
    duckUntilX: 0,
    pendingDuckX: null,
    spoiled: false,
    clipAtMs: null,
    bonkAtMs: null,
    bonkExitX: 0,
    bonkOutMs: null,
    boostUntilMs: 0,
    accepted: [],
    topTaps: 0,
    acted: -1,
    jumps: [],
    ducks: [],
  };
}

export function isObstacleAirborne(state: ObstacleRunner): boolean {
  return state.jumpX != null && state.x < state.jumpX + state.jumpAirM;
}

export function isDucking(state: ObstacleRunner): boolean {
  return state.duckX != null && state.x >= state.duckX && state.x < state.duckUntilX;
}

/** The section whose body (`at` to `end`) holds the front paws, if any. */
export function sectionAt(course: ObstacleCourse, x: number): CourseSection | null {
  return course.sections.find((section) => x >= section.at && x < section.end) ?? null;
}

function speedFactor(state: ObstacleRunner, config: ObstacleConfig): number {
  let factor = 1;
  if (state.clipAtMs != null) {
    const since = state.tMs - state.clipAtMs;
    if (since < config.clipMs) factor = Math.min(factor, config.clipSpeed);
    else if (since < config.clipMs + config.recoverMs) {
      factor = Math.min(factor, lerp(config.clipSpeed, 1, (since - config.clipMs) / config.recoverMs));
    }
  }
  if (state.bonkAtMs != null) {
    const since = state.tMs - state.bonkAtMs;
    if (since < config.clipMs) factor = Math.min(factor, config.clipSpeed);
    else if (state.bonkOutMs == null) factor = Math.min(factor, config.crawlSpeed);
    else {
      const out = state.tMs - Math.max(state.bonkOutMs, state.bonkAtMs + config.clipMs);
      if (out < config.recoverMs) factor = Math.min(factor, lerp(config.crawlSpeed, 1, out / config.recoverMs));
    }
  }
  if (factor < 1) return factor;
  return state.tMs < state.boostUntilMs ? 1 + config.perfectBoost : 1;
}

function acceptTap(state: ObstacleRunner, tMs: number, config: ObstacleConfig): boolean {
  const windowStart = tMs - config.tapWindowMs;
  state.accepted = state.accepted.filter((at) => at > windowStart);
  if (state.accepted.length >= config.tapCap) return false;
  state.accepted.push(tMs);
  state.topTaps = Math.max(state.topTaps, state.accepted.length);
  return true;
}

function judge(state: ObstacleRunner, course: Course, half: number, mods: Modifiers | null): void {
  const section = course.obstacles[state.next];
  const config = course.config;
  const center = zoneCenter(section, config.version);
  const from = section.kind === 'hurdle' ? state.pendingJumpX : state.pendingDuckX;
  let outcome: ObstacleOutcome = 'miss';
  if (!state.spoiled && from != null && Math.abs(from - center) <= half) {
    outcome = Math.abs(from - center) <= half * config.perfectShare ? 'perfect' : 'good';
  }
  state.outcomes.push(outcome);
  state.outcomeMs.push(state.tMs);
  state.next += 1;
  state.pendingJumpX = null;
  state.pendingDuckX = null;
  state.spoiled = false;
  if (outcome === 'perfect') state.boostUntilMs = state.tMs + boostMs(course, mods);
  if (section.kind === 'hurdle') {
    if (outcome === 'miss') {
      state.clipAtMs = state.tMs;
      state.boostUntilMs = 0;
      state.jumpX = null;
    }
    return;
  }
  if (outcome === 'miss') {
    state.bonkAtMs = state.tMs;
    state.bonkExitX = section.end;
    state.bonkOutMs = null;
    state.boostUntilMs = 0;
    state.jumpX = null;
    state.duckX = null;
  } else {
    // A clean duck stays low through the tube.
    state.duckUntilX = section.end;
  }
}

function cruiseStep(
  state: ObstacleRunner,
  course: Course,
  base: number,
  taps: readonly number[],
  mods: Modifiers | null,
  npc: ObstacleNpc | null,
  dt: number,
): void {
  const config = course.config;
  let cruise = state.cruise ?? base;
  const sprint = sectionAt(course, state.x);
  if (sprint?.kind === 'sprint') {
    if (npc) {
      const target = Math.min(config.topSpeed, npcSpeed(npc, state.tMs, config.npcSprintVersion));
      cruise += clamp(target - cruise, -config.rampMps2 * dt, config.rampMps2 * dt);
    } else {
      const along = clamp(((state.x - sprint.at) / (sprint.end - sprint.at) - config.fadeStart) / (1 - config.fadeStart), 0, 1);
      const stamina = mods ? unit(mods.stamina) : 0.5;
      const power = 1 - config.fadeAmount * (1 - stamina) * along;
      for (const tap of taps) {
        if (acceptTap(state, tap, config)) cruise = Math.min(config.topSpeed, cruise + config.tapAccel * power);
      }
      cruise = Math.max(base * config.sprintFloor, cruise * Math.exp(-config.fadePerSec * dt));
    }
  } else if (cruise > base) {
    cruise = Math.max(base, cruise * Math.exp(-config.fadePerSec * dt));
  } else {
    cruise = Math.min(base, cruise + config.rampMps2 * dt);
  }
  state.cruise = cruise;
}

// One fixed step. Inputs are button taps (ms from Go) that fall in this step. NPCs follow their plan.
export function stepObstacleRunner(
  state: ObstacleRunner,
  inputs: readonly ObstacleInput[],
  mods: Modifiers | null,
  npc: ObstacleNpc | null,
  classId: RaceClassId,
  version: string,
  courseSeed: string,
  plan: readonly number[] | null = null,
): void {
  if (state.finishMs != null) return;
  const course = courseFor(classId, version, courseSeed);
  const config = course.config;
  const stepMs = 1000 / config.stepHz;
  const dt = stepMs / 1000;
  const next = state.tMs + stepMs;
  const playerMods = npc ? null : mods;
  const half = obstacleZoneHalfWidth(classId, playerMods, version);
  const base = baseSpeed(course, playerMods, npc);
  const obstacle = course.obstacles[state.next] ?? null;
  const open = sectionAt(course, state.x) == null;

  let wantJump = false;
  let wantDuck = false;
  const taps: number[] = [];
  if (npc) {
    if (plan && obstacle && state.acted < state.next && state.x >= plan[state.next]) {
      state.acted = state.next;
      if (obstacle.kind === 'hurdle') wantJump = true;
      else wantDuck = true;
    }
  } else {
    for (const input of inputs) {
      if (input.tMs < state.tMs || input.tMs >= next) continue;
      if (input.button === 'jump') wantJump = true;
      else if (input.button === 'duck') wantDuck = true;
      else taps.push(input.tMs);
    }
  }

  const free = open && obstacle != null && !isObstacleAirborne(state) && !isDucking(state);
  if (wantJump && free) {
    state.jumpX = state.x;
    state.jumps.push(state.tMs);
    if (obstacle.kind === 'hurdle') {
      state.jumpAirM = config.airM;
      state.pendingJumpX = state.x;
    } else {
      state.jumpAirM = config.hopM;
      state.spoiled = true;
    }
  } else if (wantDuck && free) {
    state.duckX = state.x;
    state.duckUntilX = state.x + duckLengthM(half, version);
    state.ducks.push(state.tMs);
    if (obstacle.kind === 'tunnel') state.pendingDuckX = state.x;
    else state.spoiled = true;
  }

  cruiseStep(state, course, base, taps, playerMods, npc, dt);
  state.v = (state.cruise ?? base) * speedFactor(state, config);
  state.x += state.v * dt;
  state.tMs = next;

  while (state.next < course.obstacles.length) {
    const ahead = course.obstacles[state.next];
    // A leap that already landed before the bar was too early; the pet may jump again.
    if (ahead.kind === 'hurdle' && state.pendingJumpX != null && state.pendingJumpX + state.jumpAirM <= ahead.at && state.x >= state.pendingJumpX + state.jumpAirM) {
      state.pendingJumpX = null;
    }
    // A duck that stands back up before the mouth loses the tunnel.
    if (ahead.kind === 'tunnel' && state.pendingDuckX != null && state.duckUntilX <= ahead.at && state.x >= state.duckUntilX) {
      state.pendingDuckX = null;
      state.spoiled = true;
    }
    if (state.x < ahead.at) break;
    judge(state, course, half, playerMods);
  }

  if (state.bonkAtMs != null && state.bonkOutMs == null && state.x >= state.bonkExitX) {
    state.bonkOutMs = state.tMs;
  }

  if (state.x >= course.distanceM) {
    state.finishMs = state.tMs;
  } else if (state.tMs >= config.maxMs) {
    state.finishMs = null;
    state.tMs = config.maxMs;
  }
}

export function runObstacle(
  inputs: readonly ObstacleInput[],
  mods: Modifiers | null,
  npc: ObstacleNpc | null,
  classId: RaceClassId,
  version: string,
  courseSeed: string,
): ObstacleRunner {
  const config = obstacleConfigFor(version);
  const state = createObstacleRunner();
  const plan = npc ? npcObstaclePlan(npc, version, courseSeed) : null;
  const sorted = [...inputs].sort((a, b) => a.tMs - b.tMs);
  const stepMs = 1000 / config.stepHz;
  let cursor = 0;
  const limit = config.maxMs * config.stepHz;
  for (let i = 0; i < limit && state.finishMs == null && state.tMs < config.maxMs; i += 1) {
    const end = state.tMs + stepMs;
    const due: ObstacleInput[] = [];
    while (cursor < sorted.length && sorted[cursor].tMs < end) {
      if (sorted[cursor].tMs >= state.tMs) due.push(sorted[cursor]);
      cursor += 1;
    }
    stepObstacleRunner(state, due, mods, npc, classId, version, courseSeed, plan);
  }
  return state;
}

export function obstacleStat(
  outcomes: readonly ObstacleOutcome[],
  total: number,
  topTaps: number,
): { clean: number; perfect: number; total: number; topTaps: number } {
  return {
    clean: outcomes.filter((o) => o !== 'miss').length,
    perfect: outcomes.filter((o) => o === 'perfect').length,
    total,
    topTaps,
  };
}
