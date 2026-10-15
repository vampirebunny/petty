import { advance } from '../advance';
import { createPet } from '../createPet';
import type { Needs, PetState } from '../types';

const hourMs = 60 * 60 * 1000;

function pet(partial: Omit<Partial<PetState>, 'needs'> & { needs?: Partial<Needs> } = {}): PetState {
  const base = createPet(1, 1_000);
  return {
    ...base,
    ...partial,
    needs: { ...base.needs, ...partial.needs },
  };
}

function expectNeeds(actual: Needs, expected: Needs) {
  expect(actual.fullness).toBeCloseTo(expected.fullness, 5);
  expect(actual.energy).toBeCloseTo(expected.energy, 5);
  expect(actual.happiness).toBeCloseTo(expected.happiness, 5);
}

it('applies one awake hour of decay', () => {
  const before = pet();
  const after = advance(before, hourMs);

  expectNeeds(after.needs, { fullness: 72, energy: 75, happiness: 77 });
  expect(after.asleep).toBe(false);
  expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt + hourMs);
  expect(after.rngState).toBe(before.rngState);
  expect(before.needs).toEqual({ fullness: 80, energy: 80, happiness: 80 });
});

it('applies an extra happiness penalty while awake and a need is low', () => {
  const after = advance(
    pet({ needs: { fullness: 20, energy: 80, happiness: 50 } }),
    hourMs,
  );

  expectNeeds(after.needs, { fullness: 12, energy: 75, happiness: 41 });
});

it('restores energy during one asleep hour and stays asleep below 100', () => {
  const after = advance(pet({ asleep: true }), hourMs);

  expectNeeds(after.needs, { fullness: 76, energy: 92, happiness: 79 });
  expect(after.asleep).toBe(true);
});

it('wakes at full energy and uses awake decay for the rest of the call', () => {
  const after = advance(pet({ asleep: true, needs: { energy: 90 } }), hourMs);

  expect(after.asleep).toBe(false);
  expectNeeds(after.needs, {
    fullness: 80 - (4 * 10) / 12 - (8 * 2) / 12,
    energy: 100 - (5 * 2) / 12,
    happiness: 80 - (1 * 10) / 12 - (3 * 2) / 12,
  });
});

it('treats a 100-hour gap the same as a 48-hour gap', () => {
  const before = pet();

  expect(advance(before, 100 * hourMs)).toEqual(advance(before, 48 * hourMs));
});

it('keeps needs inside 0 to 100', () => {
  const drained = advance(pet({ needs: { fullness: 0, energy: 0, happiness: 0 } }), 48 * hourMs);
  expectNeeds(drained.needs, { fullness: 0, energy: 0, happiness: 0 });

  const filled = advance(
    pet({ asleep: true, needs: { fullness: 100, energy: 99, happiness: 100 } }),
    5 * 60 * 1000,
  );
  expect(filled.needs.energy).toBe(100);
  expect(filled.needs.fullness).toBeLessThanOrEqual(100);
  expect(filled.needs.happiness).toBeLessThanOrEqual(100);
  expect(filled.asleep).toBe(false);
});

it('carries leftover minutes by advancing the clock one step', () => {
  const before = pet();
  const after = advance(before, 7 * 60 * 1000);

  expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt + 5 * 60 * 1000);
  expectNeeds(after.needs, {
    fullness: 80 - 8 / 12,
    energy: 80 - 5 / 12,
    happiness: 80 - 3 / 12,
  });
});
