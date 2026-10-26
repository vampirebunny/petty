import { askHouseLeave, faceAfterHalfTurns, halfTurnsFor, shouldFlipHouse, startHouse, stepHouse } from '../conservatory';
import type { Prop } from '../scenes';

const house = { kind: 'dogHouse', id: 'dogHouse', x: 400, y: 400, w: 260, flip: false } as Prop;

it('ends an odd spin facing the door', () => {
  expect(halfTurnsFor(0.1)).toBe(3);
  expect(halfTurnsFor(0.9)).toBe(5);
  expect(faceAfterHalfTurns(1, 3)).toBe(-1);
  expect(faceAfterHalfTurns(1, 5)).toBe(-1);
  expect(faceAfterHalfTurns(-1, 3)).toBe(1);
});

it('finishes the half-turn, then one more when the dog is not facing the door', () => {
  const run = startHouse(house, 0.1, false);
  run.phase = 'spin';
  run.turnsDone = 1;
  run.turnT = run.turnDur;
  run.face = faceAfterHalfTurns(run.into, 1);
  askHouseLeave(run);
  const actor = { x: house.x, y: house.y };
  stepHouse(run, house, actor, 0.02, () => 0.9, false);
  expect(run.phase).toBe('spin');
  expect(run.leaveTurn).toBe(true);
  expect(run.face).toBe(run.into);
  run.turnT = run.turnDur;
  stepHouse(run, house, actor, 0.02, () => 0.9, false);
  expect(run.phase).toBe('out');
  expect(run.face).toBe(-run.into);
});

it('mirrors the house when the door faces the edge', () => {
  expect(shouldFlipHouse(40, 28, 800)).toBe(true);
  expect(shouldFlipHouse(400, 28, 800)).toBe(false);
});
