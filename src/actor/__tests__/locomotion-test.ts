import { toyAllows } from '../../items/playRules';
import { gaitDefs, stageProfiles } from '../data/locomotion';
import { geomOf } from '../geometry';
import {
  blendedFoot,
  chooseGait,
  energySpeedScale,
  gaitFootFor,
  isGaitAllowed,
  landImpact,
  locoModsOf,
  maxGaitOf,
  newGaitState,
  phaseRate,
  predictCrossing,
  sampleChaseSpeed,
  stageProfileOf,
  stepGait,
  stepStamina,
} from '../locomotion';
import { breedById } from '../breeds';
import { createWorld, spawnActor, startUserTask, update } from '../sim';
import type { ActorSource } from '../types';

const stats = { stamina: 0.5, agility: 0.5, boldness: 0.5, obedience: 0.5 };

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return { id: 'pet', breedId: 'retriever', ageDays: 100, weight: 0, vitality: 1, equipped: {}, asleep: false, ...overrides };
}

describe('gaits', () => {
  it('moves up through the gaits with speed and holds each with hysteresis', () => {
    expect(chooseGait('walk', 0.3, 'gallop')).toBe('walk');
    expect(chooseGait('walk', 0.6, 'gallop')).toBe('trot');
    expect(chooseGait('walk', 1, 'gallop')).toBe('gallop');
    // Just under the trot threshold it stays at trot until clearly below.
    expect(chooseGait('trot', gaitDefs.trot.enter - 0.02, 'gallop')).toBe('trot');
    expect(chooseGait('trot', gaitDefs.trot.enter - 0.2, 'gallop')).toBe('walk');
    expect(chooseGait('gallop', 1, 'trot')).toBe('trot');
  });

  it('blends between gaits over about 150 ms without a pop', () => {
    const state = newGaitState();
    const phase = 1.3;
    const before = blendedFoot(state, 0, phase, 40, 0.5);
    stepGait(state, 'trot', 0);
    const start = blendedFoot(state, 0, phase, 40, 0.5);
    expect(Math.hypot(start.x - before.x, start.y - before.y)).toBeLessThan(0.001);
    let last = start;
    for (let i = 0; i < 10; i += 1) {
      stepGait(state, 'trot', 0.015);
      const foot = blendedFoot(state, 0, phase, 40, 0.5);
      expect(Math.hypot(foot.x - last.x, foot.y - last.y)).toBeLessThan(12);
      last = foot;
    }
    expect(state.blend).toBeCloseTo(1, 5);
  });

  it('has the leg patterns of each gait', () => {
    const phaseOf = (gait: 'walk' | 'trot' | 'canter' | 'gallop', leg: 0 | 1 | 2 | 3): number => gaitDefs[gait].offsets[leg];
    // Trot: diagonal pairs land together.
    expect(phaseOf('trot', 0)).toBe(phaseOf('trot', 3));
    expect(phaseOf('trot', 1)).toBe(phaseOf('trot', 2));
    // Walk: four distinct beats in a lateral sequence.
    expect(new Set(gaitDefs.walk.offsets).size).toBe(4);
    // Canter: three beats (a diagonal pair shares one).
    expect(new Set(gaitDefs.canter.offsets).size).toBe(3);
    // Gallop: rotary, with the hinds ahead of the fores.
    expect(new Set(gaitDefs.gallop.offsets).size).toBe(4);
    const planted = gaitFootFor('trot', 0, 0, 40, 10);
    expect(planted.y).toBe(0);
  });

  it('turns the legs faster for a short-legged breed at the same ground speed', () => {
    const state = newGaitState();
    state.current = 'trot';
    state.from = 'trot';
    const corgi = geomOf(breedById('corgi')!, 200, 0, 1);
    const hound = geomOf(breedById('retriever')!, 200, 0, 1);
    expect(corgi.L).toBeLessThan(hound.L);
    expect(phaseRate(state, 150, corgi.L, 0.6)).toBeGreaterThan(phaseRate(state, 150, hound.L, 0.6));
  });
});

describe('stage and stats', () => {
  it('lets puppies gallop in bursts, adolescents run fastest and elderly pets not gallop', () => {
    expect(isGaitAllowed('gallop', stageProfiles.puppy.maxGait)).toBe(true);
    expect(stageProfiles.adolescent.maxSpeed).toBeGreaterThanOrEqual(stageProfiles.adult.maxSpeed);
    expect(stageProfiles.adolescent.maxSpeed).toBeGreaterThanOrEqual(stageProfiles.puppy.maxSpeed);
    expect(stageProfiles.puppy.tumble).toBeGreaterThan(stageProfiles.adult.tumble);
    expect(stageProfiles.puppy.bow).toBeGreaterThan(stageProfiles.adult.bow);
    const elderly = stageProfileOf(900, 0.3);
    expect(isGaitAllowed('gallop', elderly.maxGait)).toBe(false);
    expect(elderly.leapCatch).toBe(0);
    expect(elderly.maxSpeed).toBeLessThan(stageProfileOf(300, 1).maxSpeed);
  });

  it('moves a senior toward adult values as vitality is restored', () => {
    const old = stageProfileOf(900, 0.4);
    const restored = stageProfileOf(900, 0.9);
    const adult = stageProfiles.adult;
    expect(Math.abs(restored.maxSpeed - adult.maxSpeed)).toBeLessThan(Math.abs(old.maxSpeed - adult.maxSpeed));
  });

  it('applies attributes and weight', () => {
    const adult = stageProfiles.adult;
    const agile = locoModsOf(adult, { ...stats, agility: 1 }, 0);
    const clumsy = locoModsOf(adult, { ...stats, agility: 0 }, 0);
    expect(agile.accel).toBeGreaterThan(clumsy.accel);
    expect(agile.jumpHeight).toBeGreaterThan(clumsy.jumpHeight);
    const heavy = locoModsOf(adult, stats, 1);
    const fit = locoModsOf(adult, stats, 0);
    expect(heavy.maxSpeed).toBeLessThan(fit.maxSpeed);
    expect(heavy.jumpHeight).toBeLessThan(fit.jumpHeight);
    expect(heavy.drain).toBeGreaterThan(fit.drain);
    expect(locoModsOf(adult, stats, -1).drain).toBeGreaterThan(fit.drain);
    expect(locoModsOf(adult, { ...stats, stamina: 1 }, 0).drain).toBeLessThan(fit.drain);
    expect(locoModsOf(adult, { ...stats, boldness: 1 }, 0).daring).toBeGreaterThan(fit.daring);
  });

  it('drops a tired pet to a slower gait and brings it back after rest', () => {
    const mods = locoModsOf(stageProfiles.adult, stats, 0);
    let state = { stamina: 1, tired: false };
    for (let i = 0; i < 600 && !state.tired; i += 1) {
      state = stepStamina(state.stamina, state.tired, 'gallop', mods, 0.05);
    }
    expect(state.tired).toBe(true);
    expect(isGaitAllowed('gallop', maxGaitOf(stageProfiles.adult, true))).toBe(false);
    for (let i = 0; i < 1200 && state.tired; i += 1) {
      state = stepStamina(state.stamina, state.tired, 'walk', mods, 0.05);
    }
    expect(state.tired).toBe(false);
  });

  it('runs a zoomy pet faster than its age speed and a tired pet slower', () => {
    expect(energySpeedScale(0.75)).toBeGreaterThan(1);
    expect(energySpeedScale(1)).toBeGreaterThan(energySpeedScale(0.75));
    expect(energySpeedScale(0.2)).toBeLessThan(energySpeedScale(0.75));
    expect(energySpeedScale(0)).toBeLessThan(energySpeedScale(0.2));
  });

  it('samples a chase speed that varies with the roll and with energy', () => {
    const low = sampleChaseSpeed(() => 0, 1, 1);
    const high = sampleChaseSpeed(() => 0.999, 1, 1);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(sampleChaseSpeed(() => 0.9, 0.1, 0.1)).toBeLessThan(sampleChaseSpeed(() => 0.9, 1, 1));
  });
});

describe('jumps', () => {
  it('lands harder, with a deeper squash, for a heavier pet', () => {
    expect(landImpact(-300, 1.4)).toBeGreaterThan(landImpact(-300, 0.7));
    expect(landImpact(-300, 1)).toBeGreaterThan(landImpact(-100, 1));
  });

  it('predicts where and when a thrown toy comes down through a height', () => {
    const world = createWorld([], 1);
    const toy = { id: 't', kind: 'ball', state: 'free' as const, x: 100, y: 200, z: 60, vx: 100, vy: 0, vz: 100 };
    const crossing = predictCrossing(toy, world.scene, 30, 3);
    expect(crossing).not.toBeNull();
    expect(crossing!.x).toBeGreaterThan(100);
    expect(crossing!.t).toBeGreaterThan(0);
  });
});

describe('toys', () => {
  it('declares what each toy allows', () => {
    expect(toyAllows('dog', 'frisbee', 'leapCatch')).toBe(true);
    expect(toyAllows('cat', 'yarn', 'stalk')).toBe(true);
    expect(toyAllows('dog', 'ball', 'stalk')).toBe(false);
  });
});

describe('play in the sim', () => {
  const run = (world: ReturnType<typeof createWorld>, seconds: number, each: () => void): void => {
    for (let i = 0; i < seconds / 0.05; i += 1) {
      update(world, 0.05);
      each();
    }
  };

  it('keeps the head out of 3/4 view and the legs in a defined gait through a whole fetch', () => {
    const pup = spawnActor(source({ ageDays: 30 }));
    const world = createWorld([pup], 9);
    startUserTask(world, pup, 'fetch', 1, { x: pup.x, y: pup.y });
    const gaits = new Set<string>();
    run(world, 12, () => {
      if (pup.task.type === 'fetch') {
        expect(pup.pose.headTurn).toBeLessThan(0.2);
      }
      gaits.add(pup.gait.current);
      expect(Number.isFinite(pup.phase)).toBe(true);
      expect(pup.z).toBeGreaterThanOrEqual(0);
    });
    expect(gaits.size).toBeGreaterThan(0);
  });

  it('bows before the chase and holds for 0.5 to 1.5 seconds', () => {
    const pup = spawnActor(source({ ageDays: 3 }));
    const world = createWorld([pup], 4);
    pup.task = { type: 'fetch', stage: 'bow', t: 0, bats: 0, cool: 0 };
    world.items = [{ id: 'ball-1', kind: 'ball', state: 'free', x: pup.x + 200, y: pup.y, z: 0, vx: 0, vy: 0, vz: 0 }];
    let held = 0;
    run(world, 2.2, () => {
      if (pup.task.stage === 'bow') {
        held += 0.05;
      }
    });
    expect(held).toBeGreaterThanOrEqual(0.45);
    expect(held).toBeLessThanOrEqual(1.6);
    expect(pup.task.stage).not.toBe('bow');
  });

  it('has a cat stalk, wiggle and pounce at a toy lying still', () => {
    const kit = spawnActor(source({ id: 'kit', breedId: 'domesticShorthair', ageDays: 100 }));
    const world = createWorld([kit], 6);
    world.toyKind = 'yarn';
    kit.x = 100;
    kit.y = 300;
    kit.task = { type: 'fetch', stage: 'chase', t: 0, bats: 0, cool: 0 };
    world.items = [{ id: 'yarn-1', kind: 'yarn', state: 'free', x: 260, y: 300, z: 0, vx: 0, vy: 0, vz: 0 }];
    const seen = new Set<string>();
    run(world, 8, () => seen.add(kit.task.stage));
    expect(seen.has('stalk')).toBe(true);
    expect(seen.has('wiggle')).toBe(true);
    expect(seen.has('pounce')).toBe(true);
  });

  it('never leaves the stage while zooming a lap', () => {
    const pup = spawnActor(source({ ageDays: 30 }));
    const world = createWorld([pup], 2);
    pup.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 } as typeof pup.task;
    pup.idle.mode = 'zoom';
    pup.zoom = { leg: 0, legs: 4, first: -1 };
    pup.idle.dur = 30;
    pup.idle.arrived = true;
    let top = 0;
    run(world, 10, () => {
      top = Math.max(top, pup.speed);
      expect(pup.x).toBeGreaterThanOrEqual(0);
      expect(pup.x).toBeLessThanOrEqual(1000);
    });
    expect(top).toBeGreaterThan(100);
  });
});
