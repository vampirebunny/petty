import { testPet } from '../../sim/__fixtures__/pets';
import { boostRemainingSec } from '../../sim/effects';
import { applyRewardTreat, giveTreat } from '../rules';
import { treatsInInventory } from '../kinds';

it('applies treat hunger and weight with no daily cap', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  pet.needs.hunger = 40;

  const first = giveTreat(pet, 'biscuit', 1_000);
  expect(first.ok).toBe(true);
  if (!first.ok) {
    return;
  }
  expect(first.state.needs.hunger).toBe(30);
  expect(first.state.needs.happiness).toBe(pet.needs.happiness + 10);
  expect(first.state.weight).toBeCloseTo(pet.weight + 0.04, 5);

  const again = giveTreat(first.state, 'biscuit', 1_000);
  expect(again.ok).toBe(true);
  if (!again.ok) {
    return;
  }
  expect(again.state.needs.hunger).toBe(20);
});

it('keeps boost remaining time after time away', () => {
  const now = 10_000;
  const boost = { attribute: 'stamina', multiplier: 1.2, startAt: now, endAt: now + 3_600_000 };
  expect(boostRemainingSec(boost, now + 600_000)).toBeCloseTo(3000, 5);
  expect(boostRemainingSec(boost, now + 4_000_000)).toBe(0);
});

it('gives a training treat the same mood and a smaller bite', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  pet.needs.hunger = 40;
  const paid = applyRewardTreat(pet, 'biscuit', 1_000);
  expect(paid.ok).toBe(true);
  if (!paid.ok) {
    return;
  }
  expect(paid.state.needs.happiness).toBe(pet.needs.happiness + 10);
  expect(paid.state.needs.hunger).toBeCloseTo(37.5, 5);
});

it('lists only treats the pet has, and none when the pantry is empty', () => {
  expect(treatsInInventory([{ itemId: 'biscuit', qty: 4 }, { itemId: 'special', qty: 0 }], 'dog')).toEqual([
    { id: 'biscuit', name: 'Biscuit', count: 4 },
  ]);
  expect(treatsInInventory([], 'cat')).toEqual([]);
});

it('refuses a treat when hunger is already 0', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  pet.needs.hunger = 0;
  expect(giveTreat(pet, 'biscuit', 1_000)).toEqual({ ok: false, reason: 'full' });
});
