import { liveRestGrant } from '../config';

it('rests slower off a bed and multiplies only the player on a bed', () => {
  expect(liveRestGrant(false, 2.5, false)).toBe(3);
  expect(liveRestGrant(true, 1, false)).toBe(5);
  expect(liveRestGrant(true, 2, false)).toBe(10);
  expect(liveRestGrant(true, 2.5, false)).toBe(12.5);
  expect(liveRestGrant(true, 2.5, true)).toBe(5);
});
