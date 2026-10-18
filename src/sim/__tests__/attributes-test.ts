import { createPet } from '../createPet';
import {
  attributeScore,
  naturalGrowth,
  shownLevel,
  trainingGain,
} from '../attributes';
import { applyCareTime } from '../care';
import { dayMs } from '../config';
import { debugJump } from '../clock';

function pet() {
  return createPet(3, 'husky', 0, 0, 'Pup', 'pet');
}

it('starts near a quarter of potential and stops near 70 percent', () => {
  const young = pet();
  const stamina = young.potential.stamina;
  expect(naturalGrowth(stamina, 0)).toBe(Math.max(1, Math.round(stamina * 0.25)));
  expect(naturalGrowth(stamina, 1)).toBe(Math.round(stamina * 0.7));
  expect(attributeScore(young, 'stamina')).toBeLessThanOrEqual(stamina);
});

it('tapers a gain much harder near potential', () => {
  const potential = 12;
  const far = trainingGain(3, potential, 4);
  const near = trainingGain(potential - 1, potential, 4);
  expect(near).toBeLessThan(far * 0.2);
  expect(trainingGain(potential, potential, 4)).toBe(0);
});

it('changes only the effective score for aging and weight', () => {
  const fit = { ...pet(), ageDays: 200, maturity: 1, vitality: 0.35, weight: 0 };
  const heavy = { ...fit, weight: 1 };
  expect(attributeScore(heavy, 'stamina')).toBeLessThan(attributeScore(fit, 'stamina'));
  expect(heavy.potential).toEqual(fit.potential);
  expect(heavy.trained).toEqual(fit.trained);

  const adult = { ...pet(), ageDays: 100, maturity: 100 / 180, vitality: 0.35, weight: 0 };
  expect(attributeScore(fit, 'obedience')).toBeGreaterThan(attributeScore(adult, 'obedience'));
});

it('pulls drift toward 0 on a capped absence and respects the level ceiling', () => {
  const before = pet();
  before.drift.affection = 2;
  const after = applyCareTime(before, 10 * dayMs, true, true);
  expect(after.drift.affection).toBeLessThan(2);
  expect(after.drift.affection).toBeGreaterThanOrEqual(0);

  const experienced = debugJump({ ...pet(), xp: 1000 }, 0);
  expect(shownLevel(1000, 'puppy')).toBe(6);
  expect(experienced.level).toBe(6);
  const senior = debugJump({ ...pet(), xp: 1000, ageDays: 180 }, 0);
  expect(senior.level).toBe(shownLevel(1000, 'senior'));
});
