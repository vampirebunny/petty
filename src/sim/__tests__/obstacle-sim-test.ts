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
// obstacle-1 still has sprints; races stamped with it replay with them.
const sprintVersion = 'obstacle-1';
const seed = 'race-1';
const classes: RaceClassId[] = ['beginner', 'novice', 'open', 'expert', 'championship'];

type Wrong = Partial<Record<number, ObstacleButton>>;

// A player who presses at each zone center and taps RUN `rate` times a second in sprints.
function playerInputs(classId: RaceClassId, options: { rate?: number; courseSeed?: string; wrong?: Wrong; v?: string } = {}): ObstacleInput[] {
  const { rate = 6, courseSeed = seed, wrong = {}, v = version } = options;
  const course = obstacleCourse(classId, v, courseSeed);
  const state = createObstacleRunner();
  const inputs: ObstacleInput[] = [];
  let pressed = -1;
  let lastTap = -1e9;
  while (state.finishMs == null && state.tMs < obstacleConfigFor(v).maxMs) {
    const due: ObstacleInput[] = [];
    const ahead = course.obstacles[state.next];
    if (ahead && pressed < state.next && state.x >= zoneCenter(ahead, v)) {
      pressed = state.next;
      const button = wrong[state.next] ?? (ahead.kind === 'hurdle' ? 'jump' : 'duck');
      due.push({ tMs: state.tMs, button });
    }
    if (rate > 0 && sectionAt(course, state.x)?.kind === 'sprint' && state.tMs - lastTap >= 1000 / rate) {
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
    for (const v of [version, sprintVersion]) {
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
            const need = cls.gapM + (prev.kind === 'sprint' ? config.afterSprintM : 0);
            expect(section.start - prev.end).toBeGreaterThanOrEqual(need - 1e-9);
          });
          expect(distanceM).toBeCloseTo(sections[sections.length - 1].end + config.runOutM, 6);
        }
      }
    }
  });

  it('has no sprints and runs about three times the obstacle-1 course', () => {
    for (const classId of classes) {
      const seeds = Array.from({ length: 20 }, (_, i) => `s${i}`);
      const mean = (v: string) => seeds.reduce((sum, s) => sum + obstacleCourse(classId, v, s).distanceM, 0) / seeds.length;
      expect(obstacleConfig.classes[classId].sprints).toBe(0);
      const ratio = mean(version) / mean(sprintVersion);
      expect(ratio).toBeGreaterThan(2.7);
      expect(ratio).toBeLessThan(3.3);
    }
  });

  it('clears every obstacle when each button is pressed at the zone center', () => {
    for (const v of [version, sprintVersion]) {
      for (const classId of classes) {
        const result = runObstacle(playerInputs(classId, { v }), null, null, classId, v, seed);
        expect(result.finishMs).not.toBeNull();
        expect(result.outcomes.every((o) => o === 'perfect')).toBe(true);
      }
    }
  });

  it('finishes a slow course well inside the max race length', () => {
    for (const classId of classes) {
      const idle = runObstacle([], null, null, classId, version, seed);
      expect(idle.finishMs).not.toBeNull();
      expect(idle.finishMs ?? 0).toBeLessThan(obstacleConfig.maxMs * 0.75);
    }
  });

  it('a clean Beginner run beats most NPCs, and no input finishes last', () => {
    const clean = runObstacle(playerInputs('beginner'), null, null, 'beginner', version, seed);
    const idle = runObstacle([], null, null, 'beginner', version, seed);
    const npcs = Array.from({ length: 5 }, (_, i) =>
      runObstacle([], null, { classId: 'beginner', skill: i / 4, seed: `${seed}:npc${i}` }, 'beginner', version, seed),
    );
    const beaten = npcs.filter((npc) => (npc.finishMs ?? 1e9) > (clean.finishMs ?? 0)).length;
    expect(beaten).toBeGreaterThanOrEqual(4);
    for (const npc of npcs) expect(idle.finishMs ?? 1e9).toBeGreaterThan(npc.finishMs ?? 0);
    expect(idle.outcomes.every((o) => o === 'miss')).toBe(true);
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
    while (state.finishMs == null && state.tMs < obstacleConfig.maxMs) {
      stepObstacleRunner(state, [{ tMs: state.tMs, button: 'duck' }], null, null, classId, version, seed);
    }
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
    // Read after the step's fade, so the cap shows a little under 11.
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
