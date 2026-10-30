import {
  OBSTACLE_VERSION,
  createObstacleRunner,
  npcObstaclePlan,
  obstacleConfig,
  obstacleConfigFor,
  obstacleCourse,
  runObstacle,
  sectionAt,
  stepObstacleRunner,
  zoneCenter,
  type ObstacleButton,
  type ObstacleInput,
  type RaceClassId,
} from '../../../supabase/functions/_shared/race-sim/index.ts';

const version = OBSTACLE_VERSION;
const longAuto = 'obstacle-2';
const sprintVersion = 'obstacle-1';
const seed = 'race-1';
const classes: RaceClassId[] = ['beginner', 'novice', 'open', 'expert', 'championship'];

type Wrong = Partial<Record<number, ObstacleButton>>;

// Press JUMP/DUCK at each zone center. On tapDrive courses (and in pink sprints) also tap RUN.
function playerInputs(classId: RaceClassId, options: { rate?: number; courseSeed?: string; wrong?: Wrong; v?: string } = {}): ObstacleInput[] {
  const { rate = 6, courseSeed = seed, wrong = {}, v = version } = options;
  const config = obstacleConfigFor(v);
  const course = obstacleCourse(classId, v, courseSeed);
  const state = createObstacleRunner();
  const inputs: ObstacleInput[] = [];
  let pressed = -1;
  let lastTap = -1e9;
  while (state.finishMs == null && state.tMs < config.maxMs) {
    const due: ObstacleInput[] = [];
    const ahead = course.obstacles[state.next];
    if (ahead && pressed < state.next && state.x >= zoneCenter(ahead, v)) {
      pressed = state.next;
      const button = wrong[state.next] ?? (ahead.kind === 'hurdle' ? 'jump' : 'duck');
      due.push({ tMs: state.tMs, button });
    }
    const inSprint = sectionAt(course, state.x)?.kind === 'sprint';
    if (rate > 0 && (config.tapDrive || inSprint) && state.tMs - lastTap >= 1000 / rate) {
      lastTap = state.tMs;
      due.push({ tMs: state.tMs, button: 'run' });
    }
    inputs.push(...due);
    stepObstacleRunner(state, due, null, null, classId, v, courseSeed);
  }
  return inputs;
}

describe('obstacle course sim', () => {
  it('lays the same course for one seed and varies the order between seeds', () => {
    expect(obstacleCourse('open', version, seed)).toEqual(obstacleCourse('open', version, seed));
    const orders = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) =>
        obstacleCourse('open', version, s)
          .sections.map((section) => section.kind)
          .join(','),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('matches the class counts, never puts two sprints together, and keeps the gaps', () => {
    for (const v of [version, longAuto, sprintVersion]) {
      const config = obstacleConfigFor(v);
      for (const classId of classes) {
        const cls = config.classes[classId];
        for (const s of ['a', 'b', 'c', 'd', 'e']) {
          const { sections, distanceM } = obstacleCourse(classId, v, s);
          const count = (kind: string) => sections.filter((section) => section.kind === kind).length;
          expect([count('hurdle'), count('tunnel'), count('sprint')]).toEqual([cls.hurdles, cls.tunnels, cls.sprints]);
          sections.forEach((section, i) => {
            if (i === 0) return;
            const prev = sections[i - 1];
            expect(prev.kind === 'sprint' && section.kind === 'sprint').toBe(false);
            const need = cls.gapM * Math.min(config.gapMin, config.normalMin) + (prev.kind === 'sprint' ? config.afterSprintM : 0);
            expect(section.start - prev.end).toBeGreaterThanOrEqual(need - 1e-9);
          });
          expect(distanceM).toBeCloseTo(sections[sections.length - 1].end + config.runOutM, 6);
        }
      }
    }
  });

  it('sometimes packs obstacles tightly and sometimes leaves room', () => {
    const clsGap = obstacleConfig.classes.open.gapM;
    let tight = 0;
    let roomy = 0;
    for (const s of Array.from({ length: 24 }, (_, i) => `gap-${i}`)) {
      const { sections } = obstacleCourse('open', version, s);
      for (let i = 1; i < sections.length; i += 1) {
        const gap = sections[i].start - sections[i - 1].end;
        if (gap <= clsGap * obstacleConfig.tightMax + 1e-6) tight += 1;
        if (gap >= clsGap * obstacleConfig.normalMin - 1e-6) roomy += 1;
      }
    }
    expect(tight).toBeGreaterThan(10);
    expect(roomy).toBeGreaterThan(40);
  });

  it('has no pink sprints and runs about three times the obstacle-1 course', () => {
    for (const classId of classes) {
      const seeds = Array.from({ length: 20 }, (_, i) => `s${i}`);
      const mean = (v: string) => seeds.reduce((sum, s) => sum + obstacleCourse(classId, v, s).distanceM, 0) / seeds.length;
      expect(obstacleConfig.classes[classId].sprints).toBe(0);
      expect(obstacleConfig.tapDrive).toBe(true);
      const ratio = mean(version) / mean(sprintVersion);
      expect(ratio).toBeGreaterThan(2.2);
      expect(ratio).toBeLessThan(4.2);
    }
  });

  it('clears every obstacle when each button is pressed at the zone center', () => {
    for (const v of [version, longAuto, sprintVersion]) {
      for (const classId of classes) {
        const result = runObstacle(playerInputs(classId, { v }), null, null, classId, v, seed);
        expect(result.finishMs).not.toBeNull();
        expect(result.outcomes.every((o) => o === 'perfect')).toBe(true);
      }
    }
  });

  it('needs RUN taps on obstacle-3: idle crawls and a tapping run finishes faster', () => {
    for (const classId of classes) {
      const idle = runObstacle([], null, null, classId, version, seed);
      const tapping = runObstacle(playerInputs(classId, { rate: 7 }), null, null, classId, version, seed);
      expect(tapping.finishMs).not.toBeNull();
      expect(tapping.finishMs ?? 0).toBeLessThan(idle.finishMs ?? obstacleConfig.maxMs);
      expect(idle.finishMs == null || idle.finishMs > (tapping.finishMs ?? 0) * 1.3).toBe(true);
    }
  });

  it('a clean Beginner run beats most NPCs, and no input finishes last', () => {
    const clean = runObstacle(playerInputs('beginner'), null, null, 'beginner', version, seed);
    const idle = runObstacle([], null, null, 'beginner', version, seed);
    const npcs = Array.from({ length: 5 }, (_, i) =>
      runObstacle([], null, { classId: 'beginner', skill: i / 4, seed: `${seed}:npc${i}` }, 'beginner', version, seed),
    );
    const beaten = npcs.filter((npc) => (npc.finishMs ?? 1e9) > (clean.finishMs ?? 0)).length;
    expect(beaten).toBeGreaterThanOrEqual(3);
    for (const npc of npcs) expect(idle.finishMs ?? 1e9).toBeGreaterThan(npc.finishMs ?? 0);
    expect(idle.outcomes.every((o) => o === 'miss')).toBe(true);
  });

  it('NPCs on obstacle-5 run well above class speed', () => {
    const base = obstacleConfigFor('obstacle-5').classes.open.speed;
    const [lo, hi] = obstacleConfigFor('obstacle-5').npcSpeedSpread;
    expect(lo).toBeGreaterThan(1.2);
    expect(hi).toBeGreaterThan(lo);
    for (let i = 0; i < 12; i += 1) {
      const npc = { classId: 'open' as const, skill: 0.5, seed: `fast-${i}` };
      const state = createObstacleRunner();
      stepObstacleRunner(state, [], null, npc, 'open', 'obstacle-5', seed);
      expect(state.cruise ?? 0).toBeGreaterThanOrEqual(base * lo - 1e-6);
      expect(state.cruise ?? 0).toBeLessThanOrEqual(base * hi + 1e-6);
    }
  });

  it('NPCs cruise inside their class band, at or under RUN top speed', () => {
    for (const classId of classes) {
      const [lo, hi] = obstacleConfig.classes[classId].npcSpeed ?? [0, 0];
      expect(hi).toBeLessThanOrEqual(obstacleConfig.topSpeed);
      for (let i = 0; i < 12; i += 1) {
        const npc = { classId, skill: 0.5, seed: `fast-${i}` };
        const state = createObstacleRunner();
        stepObstacleRunner(state, [], null, npc, classId, version, seed);
        expect(state.cruise ?? 0).toBeGreaterThanOrEqual(lo - 1e-6);
        expect(state.cruise ?? 0).toBeLessThanOrEqual(hi + 1e-6);
      }
    }
  });

  it('mashing RUN through every obstacle finishes behind the whole field; a steady clean run places well', () => {
    for (const classId of classes) {
      const npcs = Array.from({ length: 7 }, (_, i) =>
        runObstacle([], null, { classId, skill: i / 6, seed: `${seed}:npc${i}` }, classId, version, seed).finishMs ?? 1e9,
      ).sort((a, b) => a - b);
      const mash = Array.from({ length: 140 * 12 }, (_, i) => ({ tMs: Math.round((i * 1000) / 12), button: 'run' as const }));
      const masher = runObstacle(mash, null, null, classId, version, seed).finishMs ?? 1e9;
      expect(masher).toBeGreaterThan(npcs[npcs.length - 1]);
      const steady = runObstacle(playerInputs(classId, { rate: 4 }), null, null, classId, version, seed).finishMs ?? 1e9;
      expect(steady).toBeLessThan(npcs[npcs.length - 1]);
      const fast = runObstacle(playerInputs(classId, { rate: 6 }), null, null, classId, version, seed).finishMs ?? 1e9;
      expect(fast).toBeLessThan(npcs[0]);
    }
  });

  it('counts the wrong button as a miss', () => {
    const course = obstacleCourse('open', version, seed);
    const hurdle = course.obstacles.findIndex((o) => o.kind === 'hurdle');
    const tunnel = course.obstacles.findIndex((o) => o.kind === 'tunnel');
    const result = runObstacle(playerInputs('open', { wrong: { [hurdle]: 'duck', [tunnel]: 'jump' } }), null, null, 'open', version, seed);
    expect(result.outcomes[hurdle]).toBe('miss');
    expect(result.outcomes[tunnel]).toBe('miss');
    expect(result.outcomes.filter((o) => o !== 'miss')).toHaveLength(course.obstacles.length - 2);
  });

  it('DUCK spam cannot clear a tunnel', () => {
    const classId: RaceClassId = 'beginner';
    const course = obstacleCourse(classId, version, seed);
    const state = createObstacleRunner();
    let lastRun = -1e9;
    while (state.finishMs == null && state.tMs < obstacleConfig.maxMs) {
      const due: ObstacleInput[] = [{ tMs: state.tMs, button: 'duck' }];
      if (state.tMs - lastRun >= 160) {
        lastRun = state.tMs;
        due.push({ tMs: state.tMs, button: 'run' });
      }
      stepObstacleRunner(state, due, null, null, classId, version, seed);
    }
    expect(state.outcomes).toHaveLength(course.obstacles.length);
    course.obstacles.forEach((o, i) => {
      if (o.kind === 'tunnel') expect(state.outcomes[i]).toBe('miss');
    });
  });

  it('obstacle-1: a sprint with no RUN taps fades toward 60% of base speed', () => {
    const classId: RaceClassId = 'beginner';
    const config = obstacleConfigFor(sprintVersion);
    const course = obstacleCourse(classId, sprintVersion, seed);
    const sprint = course.sections.find((s) => s.kind === 'sprint')!;
    const state = createObstacleRunner();
    let low = Infinity;
    while (state.finishMs == null && state.x < sprint.end) {
      stepObstacleRunner(state, [], null, null, classId, sprintVersion, seed);
      if (state.x > sprint.at) low = Math.min(low, state.cruise ?? Infinity);
    }
    const base = config.classes[classId].speed;
    expect(low).toBeGreaterThanOrEqual(base * config.sprintFloor - 1e-9);
    expect(low).toBeLessThan(base * 0.8);
  });

  it('obstacle-1: tapping in a sprint reaches the top speed and fades back to base afterwards', () => {
    const classId: RaceClassId = 'beginner';
    const config = obstacleConfigFor(sprintVersion);
    const course = obstacleCourse(classId, sprintVersion, seed);
    const sprint = course.sections.find((s) => s.kind === 'sprint')!;
    const inputs = playerInputs(classId, { rate: 8, v: sprintVersion });
    const state = createObstacleRunner();
    let top = 0;
    let after = 0;
    while (state.finishMs == null && state.tMs < config.maxMs) {
      const end = state.tMs + 1000 / config.stepHz;
      const due = inputs.filter((i) => i.tMs >= state.tMs && i.tMs < end);
      stepObstacleRunner(state, due, null, null, classId, sprintVersion, seed);
      if (state.x < sprint.end) top = Math.max(top, state.cruise ?? 0);
      else if (state.x > sprint.end + 4) after = state.cruise ?? 0;
    }
    expect(top).toBeGreaterThan(config.topSpeed * 0.95);
    expect(top).toBeLessThanOrEqual(config.topSpeed);
    expect(after).toBeCloseTo(config.classes[classId].speed, 6);
    expect(state.topTaps).toBeGreaterThanOrEqual(7);
  });

  it('NPC plans miss more often at low skill', () => {
    const misses = (skill: number) => {
      let count = 0;
      for (let i = 0; i < 40; i += 1) {
        const npc = { classId: 'open' as const, skill, seed: `npc-${i}` };
        count += runObstacle([], null, npc, 'open', version, seed).outcomes.filter((o) => o === 'miss').length;
        expect(npcObstaclePlan(npc, version, seed)).toHaveLength(obstacleCourse('open', version, seed).obstacles.length);
      }
      return count;
    };
    expect(misses(0)).toBeGreaterThan(misses(1));
  });
});
