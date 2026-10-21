import { facingRing, type Facing } from '../data/facing';
import { aimOctant, mirrorDir, octantFromVelocity, projectLocal, stepToward } from '../facing';
import { createWorld, spawnActor, update } from '../sim';
import type { ActorSource } from '../types';

function source(): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 16,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    seed: 1,
  };
}

function vel(deg: number): { vx: number; vy: number } {
  const angle = (deg * Math.PI) / 180;
  return { vx: Math.cos(angle) * 40, vy: -Math.sin(angle) * 40 };
}

describe('facing sectors', () => {
  it('keeps east through 35° and steps to a diagonal only past the hysteresis', () => {
    expect(octantFromVelocity(vel(30).vx, vel(30).vy, 'E')).toBe('E');
    expect(octantFromVelocity(vel(40).vx, vel(40).vy, 'E')).toBe('E');
    expect(octantFromVelocity(vel(50).vx, vel(50).vy, 'E')).toBe('NE');
    expect(octantFromVelocity(vel(90).vx, vel(90).vy, 'NE')).toBe('N');
    expect(octantFromVelocity(vel(-90).vx, vel(-90).vy, 'SE')).toBe('S');
    expect(octantFromVelocity(2, 2, 'W')).toBe('W');
  });

  it('lets the non-axial octant choose the mirror, and the current one when both have a side', () => {
    expect(mirrorDir('SE', 'S', 0.4, 1)).toBe(1);
    expect(mirrorDir('S', 'SW', 0.2, 1)).toBe(-1);
    expect(mirrorDir('SE', 'SW', 0.4, 1)).toBe(-1);
    expect(mirrorDir('N', 'S', 0.5, -1)).toBe(-1);
    expect(mirrorDir('E', 'E', 1, 1)).toBe(1);
  });

  it('tie-breaks N to S with the face stored when the turn was aimed', () => {
    const actor = spawnActor(source());
    actor.octant = 'N';
    actor.octantFrom = 'N';
    actor.octantTarget = 'N';
    actor.face = 1;
    aimOctant(actor, 'S');
    actor.face = -1;
    expect(actor.aimFace).toBe(1);
    expect(stepToward('N', 'S', actor.aimFace)).toBe('NE');
    expect(stepToward('N', 'S', -1)).toBe('NW');
  });
});

describe('projected gait', () => {
  it('plants a paw in side view and in front view', () => {
    const before = projectLocal({ f: 12, l: 0, h: 0 }, 0);
    const after = projectLocal({ f: 8, l: 0, h: 0 }, 0);
    expect(after.x + 4).toBeCloseTo(before.x);

    const south = Math.PI / 2;
    const fore = projectLocal({ f: 18, l: 0, h: 0 }, south);
    const planted = projectLocal({ f: 14, l: 0, h: 0 }, south);
    expect(planted.y + 4).toBeCloseTo(fore.y);
  });

  it('keeps left and right from crossing, and hind paws higher and wider when facing the camera', () => {
    const south = Math.PI / 2;
    const left = projectLocal({ f: 10, l: -6, h: 0 }, south);
    const right = projectLocal({ f: 10, l: 6, h: 0 }, south);
    expect(left.x).toBeLessThan(right.x);
    const hind = projectLocal({ f: -12, l: 8, h: 0 }, south);
    const fore = projectLocal({ f: 12, l: 5, h: 0 }, south);
    expect(hind.y).toBeLessThan(fore.y);
    expect(Math.abs(hind.x)).toBeGreaterThan(Math.abs(fore.x));
  });

  it('walks a circle without resetting the stride', () => {
    const world = createWorld([spawnActor(source())]);
    const actor = world.actors[0];
    actor.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
    const eastSide = (octant: Facing): boolean => octant === 'E' || octant === 'NE' || octant === 'SE';
    const westSide = (octant: Facing): boolean => octant === 'W' || octant === 'NW' || octant === 'SW';
    let phase = actor.phase;
    for (let step = 0; step < 240; step += 1) {
      const angle = step * 0.15;
      actor.idle = {
        mode: 'walk',
        t: 0,
        dur: 99,
        target: { x: 320 + Math.cos(angle) * 90, y: 460 + Math.sin(angle) * 50 },
        sit: false,
        arrived: false,
      };
      update(world, 0.05);
      expect(actor.phase + 1e-6).toBeGreaterThanOrEqual(phase);
      phase = actor.phase;
      expect(actor.anchors.facing).toBe(mirrorDir(actor.octantFrom, actor.octant, actor.octantBlend, actor.face));
      if (actor.octantBlend < 1 && eastSide(actor.octant) && eastSide(actor.octantFrom)) {
        expect(actor.anchors.facing).toBe(1);
      }
      if (actor.octantBlend < 1 && westSide(actor.octant) && westSide(actor.octantFrom)) {
        expect(actor.anchors.facing).toBe(-1);
      }
    }
    expect(facingRing).toHaveLength(8);
  });
});
