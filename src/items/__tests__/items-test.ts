import { scenes } from '../../actor/scenes';
import { claimItem } from '../contention';
import { ITEM_KINDS } from '../kinds';
import { stepItem } from '../physics';
import { playRuleFor } from '../playRules';
import type { Item } from '../types';

function ball(partial: Partial<Item> = {}): Item {
  return {
    id: 'ball-1',
    kind: 'ball',
    x: 100,
    y: 200,
    z: 40,
    vx: 80,
    vy: 0,
    vz: 0,
    state: 'free',
    ...partial,
  };
}

it('registers live ball and stub toy kinds', () => {
  expect(ITEM_KINDS.ball.stub).toBeUndefined();
  expect(ITEM_KINDS.frisbee.stub).toBe(true);
  expect(ITEM_KINDS.squeaky.stub).toBe(true);
  expect(ITEM_KINDS.bone.stub).toBe(true);
  expect(ITEM_KINDS.jingleBall.stub).toBe(true);
});

it('steps free ball physics without leaving the floor', () => {
  const item = ball({ z: 10, vz: -50 });
  stepItem(item, scenes.livingroom, 0.05);
  expect(item.z).toBeGreaterThanOrEqual(0);
  expect(item.state).toBe('free');
});

it('gives the nearest actor the item and breaks ties with rng', () => {
  const item = ball({ x: 0, y: 0 });
  expect(claimItem(item, [{ id: 'a', x: 10, y: 0 }, { id: 'b', x: 30, y: 0 }], () => 0)).toBe('a');
  expect(claimItem(item, [{ id: 'a', x: 10, y: 0 }, { id: 'b', x: 10, y: 0 }], () => 0.9)).toBe('b');
});

it('keeps dog and cat ball play rules', () => {
  expect(playRuleFor('dog', 'ball')?.steps).toEqual(['chase', 'grab', 'carry', 'drop']);
  expect(playRuleFor('cat', 'ball')?.endWith).toBe('purr');
});
