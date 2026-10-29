import { testPet } from '../__fixtures__/pets';
import { attributeScore, naturalGrowth, trainingGain, withDerived, zeroStats } from '../attributes';
import { applyCareTime } from '../care';
import { GEN, dayMs, daysToSenior } from '../config';
import { debugJump } from '../clock';

function pet() {
  return testPet(3, 'husky', 0, 'Pup', 'pet');
}

it('starts at the start fraction of potential and stops near 70 percent', () => {
  const young = pet();
  const stamina = young.attributes.potential.stamina;
  expect(naturalGrowth(stamina, 0)).toBe(Math.max(1, Math.round(stamina * GEN.START_FRACTION)));
  expect(naturalGrowth(stamina, 1)).toBe(Math.round(stamina * 0.7));
  expect(attributeScore(young, 'stamina')).toBeLessThanOrEqual(stamina);
});

it('tapers a gain much harder near potential', () => {
  const potential = 80;
  const far = trainingGain(20, potential, 4);
  const near = trainingGain(potential - 4, potential, 4);
  expect(near).toBeLessThan(far * 0.2);
  expect(trainingGain(potential, potential, 4)).toBe(0);
});

it('changes only the effective score for aging and weight', () => {
  const fit = { ...pet(), ageDays: daysToSenior, maturity: 1, vitality: 0.35, weight: 0 };
  const heavy = { ...fit, weight: 1 };
  expect(attributeScore(heavy, 'stamina')).toBeLessThan(attributeScore(fit, 'stamina'));
  expect(heavy.attributes.potential).toEqual(fit.attributes.potential);
  expect(heavy.attributes.current).toEqual(fit.attributes.current);

  const adult = { ...pet(), ageDays: 16, maturity: 16 / daysToSenior, vitality: 0.35, weight: 0 };
  expect(attributeScore(fit, 'obedience')).toBeGreaterThan(attributeScore(adult, 'obedience'));
});

it('adds the trained bonus on top of natural growth and never exceeds potential', () => {
  const base = pet();
  const potential = base.attributes.potential.intelligence;
  const natural = naturalGrowth(potential, base.maturity);
  const trained = {
    ...base,
    attributes: {
      ...base.attributes,
      trained: { ...zeroStats(), intelligence: 4 },
    },
  };
  expect(attributeScore(trained, 'intelligence')).toBeCloseTo(Math.min(potential, natural + 4), 5);

  const overshoot = withDerived({
    ...base,
    attributes: {
      ...base.attributes,
      trained: { ...zeroStats(), intelligence: potential + 50 },
    },
  });
  expect(overshoot.attributes.trained?.intelligence).toBeLessThanOrEqual(Math.max(0, potential - naturalGrowth(potential, overshoot.maturity)));
  expect(attributeScore(overshoot, 'intelligence')).toBeLessThanOrEqual(potential);
});

it('pulls drift toward 0 on a capped absence and keeps the stored level', () => {
  const before = pet();
  before.drift.affection = 2;
  const after = applyCareTime(before, 10 * dayMs, true, true);
  expect(after.drift.affection).toBeLessThan(2);
  expect(after.drift.affection).toBeGreaterThanOrEqual(0);

  const experienced = debugJump({ ...pet(), level: 4 }, 0);
  expect(experienced.level).toBe(4);
  const senior = debugJump({ ...pet(), level: 4, ageDays: daysToSenior }, 0);
  expect(senior.level).toBe(4);
});
