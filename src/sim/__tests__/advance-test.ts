import { advance } from '../advance';
import { tickForeground } from '../clock';
import { decayPerHour, extraHappinessDecayPerHour } from '../config';
import { testPet } from '../__fixtures__/pets';
import type { Needs, PetState } from '../types';

const hourMs = 60 * 60 * 1000;

function pet(partial: Omit<Partial<PetState>, 'needs'> & { needs?: Partial<Needs> } = {}): PetState {
  const base = testPet(1, 'retriever', 1_000, 'Pup', 'pet');
  return {
    ...base,
    ...partial,
    needs: { ...base.needs, ...partial.needs },
  };
}

function expectNeeds(actual: Needs, expected: Needs) {
  expect(actual.hunger).toBeCloseTo(expected.hunger, 5);
  expect(actual.energy).toBeCloseTo(expected.energy, 5);
  expect(actual.happiness).toBeCloseTo(expected.happiness, 5);
}

it('applies one awake hour of decay', () => {
  const before = pet();
  const after = advance(before, hourMs);

  expectNeeds(after.needs, {
    hunger: 20 + decayPerHour.awake.hunger,
    energy: 80 + decayPerHour.awake.energy,
    happiness: 80 + decayPerHour.awake.happiness,
  });
  expect(after.asleep).toBe(false);
  expect(after.lastUpdatedAt).toBe(before.lastUpdatedAt + hourMs);
  expect(after.rngState).toBe(before.rngState);
  expect(before.needs).toEqual({ hunger: 20, energy: 80, happiness: 80 });
});

it('applies an extra happiness penalty while awake and hunger is high', () => {
  const after = advance(
    pet({ needs: { hunger: 80, energy: 80, happiness: 50 } }),
    hourMs,
  );

  expectNeeds(after.needs, {
    hunger: 100,
    energy: 80 + decayPerHour.awake.energy,
    happiness: 50 + decayPerHour.awake.happiness + extraHappinessDecayPerHour,
  });
});

it('lets idle happiness keep falling below 50', () => {
  const after = advance(pet({ needs: { hunger: 20, energy: 80, happiness: 80 } }), 2 * hourMs);
  expect(after.needs.happiness).toBeLessThan(50);
});

it('restores energy during a nap and stays asleep below 100', () => {
  const after = advance(pet({ asleep: true, needs: { energy: 0 } }), 30 * 60 * 1000);

  expectNeeds(after.needs, { hunger: 26, energy: 60, happiness: 80 + decayPerHour.asleep.happiness * 0.5 });
  expect(after.asleep).toBe(true);
});

it('wakes at full energy and uses awake decay for the rest of the call', () => {
  const after = advance(pet({ asleep: true, needs: { energy: 90 } }), hourMs);

  expect(after.asleep).toBe(false);
  // 10 energy at +120/hour is 5 asleep minutes, then 55 awake minutes.
  expectNeeds(after.needs, {
    hunger: 20 + 12 * (5 / 60) + 40 * (55 / 60),
    energy: 100 - 24 * (55 / 60),
    happiness: 80 + decayPerHour.asleep.happiness * (5 / 60) + decayPerHour.awake.happiness * (55 / 60),
  });
});

it('treats a 100-hour gap the same as a 48-hour gap', () => {
  const before = pet();

  expect(advance(before, 100 * hourMs)).toEqual(advance(before, 48 * hourMs));
});

it('keeps needs inside 0 to 100', () => {
  const drained = advance(pet({ needs: { hunger: 100, energy: 0, happiness: 0 } }), 48 * hourMs);
  expectNeeds(drained.needs, { hunger: 100, energy: 0, happiness: 0 });

  const filled = advance(
    pet({ asleep: true, needs: { hunger: 0, energy: 99, happiness: 100 } }),
    5 * 60 * 1000,
  );
  expect(filled.needs.energy).toBe(100);
  expect(filled.needs.hunger).toBeGreaterThanOrEqual(0);
  expect(filled.needs.happiness).toBeLessThanOrEqual(100);
  expect(filled.asleep).toBe(false);
});

it('applies time shorter than a step, including across foreground ticks', () => {
  const before = pet();
  const gap = 7 * 60 * 1000;
  const once = advance(before, gap);

  expect(once.lastUpdatedAt).toBe(before.lastUpdatedAt + gap);
  expectNeeds(once.needs, {
    hunger: 20 + decayPerHour.awake.hunger * (gap / hourMs),
    energy: 80 + decayPerHour.awake.energy * (gap / hourMs),
    happiness: 80 + decayPerHour.awake.happiness * (gap / hourMs),
  });

  let ticked = before;
  const tick = 5_000;
  const ticks = gap / tick;
  for (let i = 0; i < ticks; i += 1) {
    ticked = tickForeground(ticked, before.lastUpdatedAt + (i + 1) * tick);
  }
  expectNeeds(ticked.needs, once.needs);
});
