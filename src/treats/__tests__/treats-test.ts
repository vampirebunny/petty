import { testPet } from '../../sim/__fixtures__/pets';
import { boostRemainingSec } from '../../sim/effects';
import { treatDailyCap } from '../../sim/config';
import { giveTreat } from '../rules';

it('applies treat hunger and weight and enforces the daily cap', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  pet.needs.hunger = 40;
  pet.treats = [{ treatId: 'biscuit', count: 5 }];

  const first = giveTreat(pet, 'biscuit', 1_000);
  expect(first.ok).toBe(true);
  if (!first.ok) {
    return;
  }
  expect(first.state.needs.hunger).toBe(30);
  expect(first.state.weight).toBeCloseTo(pet.weight + 0.04, 5);
  expect(first.state.treatDay.count).toBe(1);

  let state = first.state;
  while (state.treatDay.count < treatDailyCap) {
    const next = giveTreat(state, 'biscuit', 1_000);
    expect(next.ok).toBe(true);
    if (!next.ok) {
      return;
    }
    state = next.state;
  }
  expect(giveTreat(state, 'biscuit', 1_000)).toEqual({ ok: false, reason: 'cap' });
});

it('keeps boost remaining time after time away', () => {
  const now = 10_000;
  const boost = { attribute: 'stamina', multiplier: 1.2, startAt: now, endAt: now + 3_600_000 };
  expect(boostRemainingSec(boost, now + 600_000)).toBeCloseTo(3000, 5);
  expect(boostRemainingSec(boost, now + 4_000_000)).toBe(0);
});

it('refuses a treat when hunger is already 0', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  pet.needs.hunger = 0;
  expect(giveTreat(pet, 'biscuit', 1_000)).toEqual({ ok: false, reason: 'full' });
});
