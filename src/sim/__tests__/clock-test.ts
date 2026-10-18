import { createPet } from '../createPet';
import { resume, setAgeDays, setWeight, tickForeground } from '../clock';
import { dayMs, weightDecayPerDay } from '../config';

const hourMs = 60 * 60 * 1000;

function pet() {
  return createPet(1, 'retriever', 0, 1_000, 'Pup', 'pet');
}

it('ages and loses weight for the whole hour the app stays open', () => {
  const before = pet();
  const after = tickForeground(before, before.lastUpdatedAt + hourMs);

  expect(after.ageDays).toBeCloseTo(1 / 24, 5);
  expect(after.weight).toBeCloseTo(before.weight - weightDecayPerDay / 24, 5);
  expect(after.bornAt).toBe(before.bornAt);
});

it('ages and thins across a full absence while needs stop at 48 hours', () => {
  const before = pet();
  const longGap = resume(before, before.lastUpdatedAt + 100 * hourMs);
  const capped = resume(before, before.lastUpdatedAt + 48 * hourMs);

  expect(longGap.ageDays).toBeCloseTo(100 / 24, 5);
  expect(capped.ageDays).toBeCloseTo(2, 5);
  expect(longGap.weight).toBeCloseTo(before.weight - weightDecayPerDay * (100 / 24), 5);
  expect(capped.weight).toBeCloseTo(before.weight - weightDecayPerDay * 2, 5);
  expect(longGap.needs).toEqual(capped.needs);
});

it('rewrites bornAt when debug age changes and clamps the weight index', () => {
  const aged = setAgeDays(pet(), 10);
  expect(aged.ageDays).toBe(10);
  expect(aged.bornAt).toBe(aged.lastUpdatedAt - 10 * dayMs);
  expect(setWeight(pet(), 4).weight).toBe(1);
  expect(setWeight(pet(), -4).weight).toBe(-1);
});

it('keeps aging after maturity reaches 1 and never lowers maturity', () => {
  const senior = setAgeDays(pet(), 180);
  const after = resume(senior, senior.lastUpdatedAt + 48 * hourMs);

  expect(senior.maturity).toBe(1);
  expect(after.ageDays).toBeCloseTo(182, 5);
  expect(after.maturity).toBe(1);
  expect(tickForeground(after, after.lastUpdatedAt + hourMs).maturity).toBe(1);
});
