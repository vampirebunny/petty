import { actionEnabled, actionReason, compileScene, loadScene, scenes, startUserTask } from '..';
import { lighting } from '../lighting';
import { phaseOf, todAt } from '../timeOfDay';
import { createWorld, spawnActor } from '../sim';

const room = {
  sky: ['#ffffff', '#eeeeee'],
  floor: { horizon: 100, yMin: 200, yMax: 300, color: ['#cccccc', '#bbbbbb'] },
};

it('blends the named hours and wraps midnight back to night', () => {
  expect(phaseOf(5)).toBe('Dawn');
  expect(phaseOf(7.5)).toBe('Morning');
  expect(phaseOf(12)).toBe('Afternoon');
  expect(phaseOf(17)).toBe('Dusk');
  expect(phaseOf(19)).toBe('Evening');
  expect(phaseOf(21.5)).toBe('Night');
  expect(phaseOf(0)).toBe('Night');

  expect(todAt(5).top).not.toBe(todAt(4.75).top);
  expect(todAt(5).top).not.toBe(todAt(6.25).top);
  expect(todAt(7.5).top).not.toBe(todAt(6.25).top);
  expect(todAt(12).dark).toBeGreaterThanOrEqual(0);
  expect(todAt(12).dark).toBeLessThan(todAt(17).dark);
  expect(todAt(19).dark).toBeGreaterThan(todAt(17).dark);
  expect(todAt(21.5).top).toBe(todAt(0).top);
  expect(todAt(24).phase).toBe('Night');
  expect(todAt(24).top).toBe(todAt(0).top);
  expect(todAt(-1).hour).toBeCloseTo(23, 5);
});

it('names a bad time and skips an unknown schema version', () => {
  expect(() => compileScene({ ...room, time: 'nope' })).toThrow('"time" must be outdoor, indoor or fixed.');
  expect(() => compileScene({ ...room, props: [{ kind: 'laser', x: 1, y: 2 }] })).toThrow('unknown kind "laser"');
  expect(loadScene({ ...room, v: 2 })).toBeNull();
  expect(compileScene(room).time).toBe('fixed');
});

it('rejects a bad actor tint and defaults the rest from the scene time', () => {
  expect(() => compileScene({ ...room, lighting: { actorTint: 1.4 } })).toThrow('"lighting.actorTint" must be a number from 0 to 1.');
  expect(() => compileScene({ ...room, lighting: { actorTint: 'full' } })).toThrow('"lighting.actorTint"');
  expect(compileScene({ ...room, time: 'indoor' }).lighting.actorTint).toBe(lighting.actorTint.indoor);
  expect(compileScene({ ...room, time: 'outdoor' }).lighting.actorTint).toBe(lighting.actorTint.outdoor);
  expect(compileScene(room).lighting.actorTint).toBe(lighting.actorTint.fixed);
  expect(compileScene({ ...room, time: 'indoor', lighting: { actorTint: 0.2 } }).lighting.actorTint).toBe(0.2);
});

it('enables an action only when the scene has its point', () => {
  expect(actionEnabled(scenes.livingroom, 'feed')).toBe(true);
  expect(actionEnabled(scenes.livingroom, 'rest')).toBe(true);
  expect(actionEnabled(scenes.livingroom, 'drink')).toBe(true);
  expect(actionEnabled(scenes.bedroom, 'drink')).toBe(true);
  expect(actionEnabled(compileScene(room), 'drink')).toBe(false);
  expect(actionEnabled(scenes.park, 'drink')).toBe(true);
  expect(actionEnabled(scenes.livingroom, 'refillWater', 0.5)).toBe(true);
  expect(actionEnabled(scenes.livingroom, 'refillWater', 1)).toBe(false);
  expect(actionEnabled(scenes.park, 'refillWater', 0)).toBe(false);
  expect(actionEnabled(scenes.park, 'feed')).toBe(false);
  expect(actionEnabled(scenes.park, 'rest')).toBe(true);
  expect(actionReason(scenes.park, 'feed')).toBe('There is no food bowl in this scene.');
  expect(actionReason(compileScene(room), 'drink')).toBe('There is no water in this scene.');
  expect(actionReason(scenes.park, 'refillWater')).toBe('There is no water bowl to refill here.');
  expect(actionReason(scenes.livingroom, 'refillWater', 1)).toBe('The water bowl is already full.');
  expect(actionReason(scenes.livingroom, 'feed')).toBe('');

  const pup = spawnActor({
    id: 'pup',
    breedId: 'retriever',
    ageDays: 0,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
  const park = createWorld([pup], 1, scenes.park);
  expect(startUserTask(park, pup, 'drink')).toBe(true);
  expect(startUserTask(park, pup, 'eat')).toBe(false);
  // With no bed the pet sleeps where it stands.
  expect(startUserTask(park, pup, 'sleep')).toBe(true);
  expect(pup.task.type).toBe('sleep');
});
