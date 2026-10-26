import { askHouseLeave, frontGate, houseSlot, octantAfter, spinStepsFor, startHouse, stepHouse } from '../conservatory';
import { HOUSE_POINTS, houseWorld } from '../conservatory';
import type { Prop } from '../scenes';

const house = { kind: 'dogHouse', id: 'dogHouse', x: 400, y: 400, w: 260, flip: false } as Prop;

it('spins an odd number of half-turns and finishes facing the camera', () => {
  expect(spinStepsFor(0.1)).toBe(12);
  expect(spinStepsFor(0.9)).toBe(20);
  expect(octantAfter('N', 12, 1)).toBe('S');
  expect(octantAfter('N', 20, 1)).toBe('S');
  expect(octantAfter('N', 12, -1)).toBe('S');
  expect(octantAfter('N', 20, -1)).toBe('S');
});

it('keeps spinning toward the camera instead of walking out backwards', () => {
  const run = startHouse(house, 0.1, false);
  run.phase = 'spin';
  run.dir = 1;
  run.spinning = true;
  run.octantFrom = 'E';
  run.octant = 'SE';
  run.turnDur = 0.2;
  run.turnT = 0.2;
  askHouseLeave(run);
  const actor = { x: house.x, y: house.y };
  stepHouse(run, house, actor, 0.02, () => 0.9, false);
  expect(run.phase).toBe('spin');
  expect(run.leaving).toBe(true);
  expect(run.octant).toBe('S');
  run.turnT = run.turnDur;
  stepHouse(run, house, actor, 0.02, () => 0.9, false);
  expect(run.phase).toBe('out');
  expect(run.octant).toBe('S');
});

it('sends a dog behind the cabana around the front', () => {
  const behind = houseWorld(house, 200, 120);
  const gate = frontGate(house, behind.x, behind.y);
  expect(gate).not.toBeNull();
  const world = houseWorld(house, gate!.x, gate!.y);
  expect(houseSlot(house, world.x, world.y)).toBe('out');
  const rest = houseWorld(house, HOUSE_POINTS.R.x, HOUSE_POINTS.R.y);
  expect(houseSlot(house, rest.x, rest.y)).toBe('in');
  const step = houseWorld(house, HOUSE_POINTS.S.x, HOUSE_POINTS.S.y);
  expect(houseSlot(house, step.x, step.y)).toBe('out');
});
