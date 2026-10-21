import { startGesture } from '../gestures';
import { createWorld, setDirection, spawnActor, update } from '../sim';
import type { ActorSource } from '../types';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pup',
    breedId: 'retriever',
    ageDays: 400,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    ...overrides,
  };
}

describe('playdate gestures', () => {
  it('keeps a double take turning the head while the pet is running', () => {
    const actor = spawnActor(source());
    const world = createWorld([actor], 1);
    setDirection(actor, { target: { x: actor.x + 800, y: actor.y }, pace: 1, pose: 'run', token: 1 });
    actor.vx = 280;
    actor.speed = 280;
    expect(startGesture(actor, 'double_take', false)).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      update(world, 1 / 60);
    }
    expect(actor.speed).toBeGreaterThan(14);
    expect(actor.pose.headTurn).toBeGreaterThan(0.85);
  });

  it('holds a directed skid after the reversing wipe', () => {
    const actor = spawnActor(source());
    const world = createWorld([actor], 2);
    setDirection(actor, { target: { x: actor.x + 400, y: actor.y }, pace: 0.6, pose: 'skid', token: 4 });
    for (let i = 0; i < 8; i += 1) {
      update(world, 0.05);
    }
    expect(actor.pose.skid).toBeGreaterThan(0.5);
  });
});
