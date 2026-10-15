import { startingNeeds } from '../config';
import { createPet } from '../createPet';

const seed = 7;
const now = 1_700_000_000_000;

it('starts awake at the configured needs and stores the clock and seed', () => {
  expect(createPet(seed, now)).toEqual({
    needs: { fullness: 80, energy: 80, happiness: 80 },
    asleep: false,
    lastUpdatedAt: now,
    rngState: seed,
  });
});

it('copies starting needs so a pet cannot change the defaults', () => {
  const first = createPet(seed, now);
  const second = createPet(seed, now);

  expect(first).toEqual(second);
  expect(first.needs).not.toBe(second.needs);

  first.needs.fullness = 0;

  expect(startingNeeds.fullness).toBe(80);
  expect(createPet(seed, now).needs.fullness).toBe(80);
});
