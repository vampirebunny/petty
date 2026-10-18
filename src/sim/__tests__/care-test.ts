import { applyEvent } from '../events';
import { createPet } from '../createPet';
import { applyCareTime } from '../care';
import { dayMs } from '../config';
import { reconcileBand } from '../attributes';
import { resume, setVitality } from '../clock';

function pet() {
  return createPet(1, 'retriever', 0, 0, 'Pup', 'pet');
}

it('adds a meal to the weight index and leaves a drink unchanged', () => {
  const before = pet();
  const fed = applyEvent(before, { type: 'feed' }).state;
  const watered = applyEvent(before, { type: 'drink' }).state;

  expect(fed.weight).toBeCloseTo(before.weight + 0.12, 5);
  expect(fed.vitality).toBe(before.vitality);
  expect(watered.weight).toBe(before.weight);
  expect(watered.ageDays).toBe(before.ageDays);
});

it('thins the pet across missed days and leaves a scene change alone', () => {
  const before = pet();
  const missed = resume(before, before.lastUpdatedAt + 7 * dayMs);
  expect(missed.weight).toBeCloseTo(before.weight - 0.12 * 7, 5);

  const moved = applyEvent(before, { type: 'setScene', sceneId: 'park' }).state;
  expect(moved.sceneId).toBe('park');
  expect(moved.weight).toBe(before.weight);
  expect(moved.ageDays).toBe(before.ageDays);
  expect(moved.needs).toEqual(before.needs);
});

it('keeps thinning through a long absence after needs have stopped', () => {
  const before = pet();
  const longGap = resume(before, before.lastUpdatedAt + 100 * 60 * 60 * 1000);
  const capped = resume(before, before.lastUpdatedAt + 48 * 60 * 60 * 1000);

  expect(longGap.weight).toBeLessThan(capped.weight);
  expect(longGap.needs).toEqual(capped.needs);
});

it('keeps care vitality at or above 0.35 and remembers band hysteresis', () => {
  const drained = applyCareTime(pet(), 40 * dayMs, true, false);
  expect(drained.vitality).toBeGreaterThanOrEqual(0.35);

  const senior = setVitality({ ...pet(), ageDays: 200 }, 0.5);
  expect(senior.seniorBand).toBe('senior');
  const inside = setVitality(senior, 0.72);
  expect(inside.seniorBand).toBe('senior');
  const left = setVitality(senior, 0.76);
  expect(left.seniorBand).toBe('earlySenior');
  const back = setVitality(left, 0.64);
  expect(back.seniorBand).toBe('senior');
  expect(reconcileBand(setVitality(back, 0.34))).toBe('elderly');
});
