import { AWAY_DECAY } from '../awayDecayConfig';
import { applyAwayDecay, type AwayNeeds } from '../awayDecay';

const full: AwayNeeds = { tummy: 100, mood: 80, energy: 40 };

it('leaves needs unchanged at 0 hours', () => {
  expect(applyAwayDecay(full, 0)).toEqual(full);
});

it('drifts tummy from 100 to 80 after 6 hours', () => {
  expect(applyAwayDecay(full, 6).tummy).toBeCloseTo(80, 5);
});

it('drifts tummy from 100 to 60 after 12 hours', () => {
  expect(applyAwayDecay(full, 12).tummy).toBeCloseTo(60, 5);
});

it('decays tummy from 100 to about 35 after 36 hours', () => {
  expect(applyAwayDecay(full, 36).tummy).toBeCloseTo(35, 5);
});

it('keeps tummy above its floor after 7 days and never at 0', () => {
  const tummy = applyAwayDecay(full, 7 * 24).tummy;
  expect(tummy).toBeGreaterThan(AWAY_DECAY.needs.tummy.floor);
  expect(tummy).toBeGreaterThan(0);
});

it('does not raise a value already below the grace target', () => {
  const low: AwayNeeds = { tummy: 40, mood: 50, energy: 40 };
  const after = applyAwayDecay(low, 6);
  expect(after.tummy).toBe(40);
  expect(after.mood).toBe(50);
});

it('raises energy toward the recover target and does not pass it', () => {
  const after = applyAwayDecay(full, AWAY_DECAY.needs.energy.recoverHalfLifeH);
  expect(after.energy).toBeGreaterThan(full.energy);
  expect(after.energy).toBeLessThanOrEqual(AWAY_DECAY.needs.energy.recoverTarget);
  const rested = applyAwayDecay({ ...full, energy: 70 }, 48);
  expect(rested.energy).toBeCloseTo(AWAY_DECAY.needs.energy.recoverTarget, 5);
});

it('ignores a negative elapsed time', () => {
  expect(applyAwayDecay(full, -3)).toEqual(full);
});

it('treats elapsed time past the cap as the cap', () => {
  const cap = AWAY_DECAY.maxElapsedH;
  expect(applyAwayDecay(full, cap + 500)).toEqual(applyAwayDecay(full, cap));
});
