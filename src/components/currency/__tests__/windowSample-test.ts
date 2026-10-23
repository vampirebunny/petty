import { acceptStageOrigin, usableCoinCenter } from '../windowSample';

it('skips a zero-size stage measure and one 0,0 origin', () => {
  const empty = acceptStageOrigin({ x: 0, y: 0, width: 0, height: 0 }, false);
  expect(empty.ok).toBe(false);
  expect(empty.skippedZero).toBe(false);

  const firstZero = acceptStageOrigin({ x: 0, y: 0, width: 400, height: 300 }, false);
  expect(firstZero.ok).toBe(false);
  expect(firstZero.skippedZero).toBe(true);

  const secondZero = acceptStageOrigin({ x: 0, y: 0, width: 400, height: 300 }, true);
  expect(secondZero.ok).toBe(true);
});

it('accepts a stage that is already under the header', () => {
  const placed = acceptStageOrigin({ x: 0, y: 116, width: 390, height: 420 }, false);
  expect(placed.ok).toBe(true);
});

it('ignores a coin center that was measured before layout', () => {
  expect(usableCoinCenter(null)).toBeNull();
  expect(usableCoinCenter({ x: 0, y: 0 })).toBeNull();
  expect(usableCoinCenter({ x: 340, y: 48 })).toEqual({ x: 340, y: 48 });
});
