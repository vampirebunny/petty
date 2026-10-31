import { friendSpot } from '../spots';

const floor = { xMin: 28, xMax: 612, yMin: 214, yMax: 654 };

describe('park friend spots', () => {
  it('picks the same point for the same pet until that point is taken', () => {
    const first = friendSpot('pet-maple', floor, [], []);
    const again = friendSpot('pet-maple', floor, [], []);
    expect(again).toEqual(first);
    expect(first.x).toBeGreaterThan(floor.xMin);
    expect(first.x).toBeLessThan(floor.xMax);
    expect(first.y).toBeGreaterThan(floor.yMin);
    expect(first.y).toBeLessThan(floor.yMax);
    const moved = friendSpot('pet-maple', floor, [first], []);
    expect(moved).not.toEqual(first);
  });

  it('steps off a solid prop', () => {
    const open = friendSpot('pet-oak', floor, [], []);
    const obstacle = { x: open.x, y: open.y, hw: 40, hd: 30 };
    const shifted = friendSpot('pet-oak', floor, [], [obstacle]);
    const nx = (shifted.x - obstacle.x) / obstacle.hw;
    const ny = (shifted.y - obstacle.y) / obstacle.hd;
    expect(nx * nx + ny * ny).toBeGreaterThan(1);
  });
});