import { testPet } from '../__fixtures__/pets';
import { applyAwayWeight } from '../awayDecay';
import { applyHappinessDelta, resume, setAgeDays, setWeight, tickForeground } from '../clock';
import { dayMs, daysToSenior, healthyWeightBand, weightDecayPerDay } from '../config';

const hourMs = 60 * 60 * 1000;

function pet() {
  return testPet(1, 'retriever', 1_000, 'Pup', 'pet');
}

it('ages and loses weight for the whole hour the app stays open', () => {
  const before = pet();
  const after = tickForeground(before, before.lastUpdatedAt + hourMs);

  expect(after.ageDays).toBeCloseTo(1 / 24, 5);
  expect(after.weight).toBeCloseTo(before.weight - weightDecayPerDay / 24, 5);
  expect(after.bornAt).toBe(before.bornAt);
});

it('ages across a full absence and thins weight on the away curve', () => {
  const before = pet();
  const longGap = resume(before, before.lastUpdatedAt + 100 * hourMs);
  const weekend = resume(before, before.lastUpdatedAt + 48 * hourMs);

  expect(longGap.ageDays).toBeCloseTo(100 / 24, 5);
  expect(weekend.ageDays).toBeCloseTo(2, 5);
  expect(weekend.weight).toBeCloseTo(applyAwayWeight(before.weight, 48), 5);
  expect(longGap.weight).toBeCloseTo(applyAwayWeight(before.weight, 100), 5);
  expect(weekend.weight).toBeGreaterThan(-healthyWeightBand);
  expect(longGap.needs).not.toEqual(weekend.needs);
});

it('leaves needs and weight unchanged when the clock moves backward', () => {
  const before = pet();
  const after = resume(before, before.lastUpdatedAt - hourMs);

  expect(after.needs).toEqual(before.needs);
  expect(after.weight).toBe(before.weight);
  expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt - hourMs);
});

it('rewrites bornAt when debug age changes and clamps the weight index', () => {
  const aged = setAgeDays(pet(), 10);
  expect(aged.ageDays).toBe(10);
  expect(aged.bornAt).toBe(aged.lastUpdatedAt - 10 * dayMs);
  expect(setWeight(pet(), 4).weight).toBe(1);
  expect(setWeight(pet(), -4).weight).toBe(-1);
});

it('adds a cuddle mood burst only when tummy and energy can raise mood', () => {
  const before = pet();
  before.needs.happiness = 40;
  expect(applyHappinessDelta(before, 5).needs.happiness).toBe(45);
  expect(applyHappinessDelta({ ...before, needs: { ...before.needs, happiness: 100 } }, 5).needs.happiness).toBe(100);
  const tired = { ...before, needs: { ...before.needs, energy: 20 } };
  expect(applyHappinessDelta(tired, 5)).toBe(tired);
  const hungry = { ...before, needs: { ...before.needs, hunger: 80 } };
  expect(applyHappinessDelta(hungry, 5)).toBe(hungry);
});

it('keeps aging after maturity reaches 1 and never lowers maturity', () => {
  const senior = setAgeDays(pet(), daysToSenior);
  const after = resume(senior, senior.lastUpdatedAt + 48 * hourMs);

  expect(senior.maturity).toBe(1);
  expect(after.ageDays).toBeCloseTo(daysToSenior + 2, 5);
  expect(after.maturity).toBe(1);
  expect(tickForeground(after, after.lastUpdatedAt + hourMs).maturity).toBe(1);
});
