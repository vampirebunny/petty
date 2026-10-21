import { createWorld, spawnActor, update } from '../sim';
import { ageJumpMods, jump, resolveJump, takeJumpOut } from '../jump';
import type { Actor, ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 8,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    ...overrides,
  };
}

function pet(overrides: Partial<ActorSource> = {}): { actor: Actor; world: ReturnType<typeof createWorld> } {
  const actor = spawnActor(source(overrides));
  const world = createWorld([actor], 1);
  update(world, 1 / 60);
  actor.x = 220;
  actor.vx = 0;
  actor.vy = 0;
  return { actor, world };
}

function run(actor: Actor, world: ReturnType<typeof createWorld>, seconds: number, each?: () => void): void {
  const steps = Math.ceil(seconds / (1 / 60));
  for (let i = 0; i < steps; i += 1) {
    update(world, 1 / 60);
    each?.();
  }
}

describe('jump phases', () => {
  it('crouches, hangs at the top of a parabola, and lands the front paws first', () => {
    const { actor, world } = pet();
    const landed: number[] = [];
    jump(actor, {
      targetX: 360,
      onLand: () => landed.push(actor.x),
    });
    const heights: number[] = [];
    const vz: number[] = [];
    let frontFirst = false;
    let sawAir = false;
    run(actor, world, 2.4, () => {
      const state = actor.jump;
      if (!state) {
        return;
      }
      if (state.phase === 'airborne') {
        sawAir = true;
        heights.push(actor.z);
        vz.push(actor.vz);
      }
      if (state.phase === 'landing' && state.t < 0.05) {
        frontFirst = state.visual.fore.plant && !state.visual.hind.plant;
      }
    });
    expect(sawAir).toBe(true);
    const peak = Math.max(...heights);
    const peakAt = heights.indexOf(peak);
    expect(peak).toBeGreaterThan(heights[0] ?? 0);
    expect(Math.abs(vz[peakAt] ?? 1)).toBeLessThan(Math.abs(vz[0] ?? 0));
    expect(frontFirst).toBe(true);
    expect(landed).toEqual([expect.any(Number)]);
    expect(landed[0]).toBeCloseTo(360, 0);
    expect(takeJumpOut(actor).map((event) => event.type)).toEqual(['land']);
  });

  it('keeps a running pet in the run blend and gives a puppy one extra hop', () => {
    const { actor, world } = pet({ ageDays: 0 });
    actor.vx = 80;
    actor.speed = 80;
    jump(actor, { distance: 1.2 });
    expect(actor.jump?.running).toBe(true);
    const phases = new Set<string>();
    run(actor, world, 3, () => {
      if (actor.jump) {
        phases.add(actor.jump.phase);
        if (actor.jump.running) {
          expect(actor.pose.walk).toBeGreaterThan(0);
        }
      }
    });
    expect(phases.has('anticipation')).toBe(true);
    expect(phases.has('bounce')).toBe(true);
    expect(actor.jump).toBeNull();
  });

  it('skips the wiggle and shortens the crouch when the jump is fast', () => {
    const { actor, world } = pet({ id: 'kit', breedId: 'domesticShorthair', ageDays: 8 });
    jump(actor, { fast: true });
    expect(actor.jump?.wiggleDur).toBe(0);
    expect(actor.jump?.anticipation).toBeLessThanOrEqual(0.06);
    const phases = new Set<string>();
    run(actor, world, 2, () => {
      if (actor.jump) {
        phases.add(actor.jump.phase);
      }
    });
    expect(phases.has('wiggle')).toBe(false);
    expect(phases.has('anticipation')).toBe(true);
    expect(phases.has('airborne')).toBe(true);
  });

  it('wiggles a cat before the crouch and jumps higher than a dog', () => {
    const dog = pet();
    const cat = pet({ id: 'kit', breedId: 'domesticShorthair', ageDays: 8 });
    jump(dog.actor, {});
    jump(cat.actor, {});
    expect(cat.actor.jump?.wiggleDur).toBeGreaterThan(0);
    expect(dog.actor.jump?.wiggleDur).toBe(0);
    expect(cat.actor.jump?.heightPx).toBeGreaterThan(dog.actor.jump?.heightPx ?? 0);
    const phases = new Set<string>();
    run(cat.actor, cat.world, 1, () => {
      if (cat.actor.jump) {
        phases.add(cat.actor.jump.phase);
      }
    });
    expect(phases.has('wiggle')).toBe(true);
    expect(phases.has('anticipation')).toBe(true);
  });
});

describe('jump build', () => {
  it('scales height smoothly with age and clamps a senior', () => {
    expect(ageJumpMods(0).height).toBeCloseTo(0.7);
    expect(ageJumpMods(8).height).toBeCloseTo(1);
    expect(ageJumpMods(30).height).toBeCloseTo(0.5);
    expect(ageJumpMods(17).height).toBeGreaterThan(ageJumpMods(30).height);
    expect(ageJumpMods(17).height).toBeLessThan(ageJumpMods(8).height);

    const young = pet({ ageDays: 0 });
    const adult = pet({ ageDays: 8 });
    const senior = pet({ ageDays: 30 });
    const youngJump = resolveJump(young.actor, {});
    const adultJump = resolveJump(adult.actor, {});
    const seniorJump = resolveJump(senior.actor, { heightPx: 500, obstacleHeight: 200 });
    expect(youngJump).not.toBeNull();
    expect(adultJump).not.toBeNull();
    expect(seniorJump).not.toBeNull();
    if (!youngJump || !adultJump || !seniorJump) {
      return;
    }
    expect(youngJump.heightPx).toBeLessThan(adultJump.heightPx);
    expect(seniorJump.heightPx).toBeLessThan(adultJump.heightPx * 0.75);
    expect(youngJump.squash).toBeGreaterThan(adultJump.squash);
    expect(seniorJump.squash).toBeLessThan(adultJump.squash);
  });

  it('raises height with agility and ignores stamina', () => {
    const { actor } = pet();
    actor.stats.agility = 0;
    actor.stats.stamina = 0;
    const slow = resolveJump(actor, {});
    actor.stats.agility = 1;
    actor.stats.stamina = 1;
    const quick = resolveJump(actor, {});
    expect(slow).not.toBeNull();
    expect(quick).not.toBeNull();
    if (!slow || !quick) {
      return;
    }
    expect(quick.heightPx).toBeGreaterThan(slow.heightPx);
    expect(quick.distancePx).toBeGreaterThan(slow.distancePx);
    actor.stats.agility = 0.5;
    const low = resolveJump(actor, {});
    actor.stats.stamina = 0;
    const tired = resolveJump(actor, {});
    expect(tired?.heightPx).toBeCloseTo(low?.heightPx ?? -1);
  });

  it('clears an obstacle and drops the dust and the puppy hop when motion is reduced', () => {
    const { actor, world } = pet({ ageDays: 0 });
    const plain = resolveJump(actor, {});
    expect(plain).not.toBeNull();
    if (!plain) {
      return;
    }
    const over = resolveJump(actor, { obstacleHeight: plain.heightPx + 30 });
    expect(over).not.toBeNull();
    if (!over) {
      return;
    }
    expect(over.heightPx).toBeGreaterThan(plain.heightPx);
    jump(actor, { reduced: true });
    const dust = new Set<number>();
    const phases = new Set<string>();
    run(actor, world, 2.5, () => {
      if (!actor.jump) {
        return;
      }
      phases.add(actor.jump.phase);
      dust.add(actor.jump.dust.length);
    });
    expect(phases.has('bounce')).toBe(false);
    expect(Math.max(...dust, 0)).toBe(0);
  });
});
