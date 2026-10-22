import { levelsToPay, stagesToPay } from '../levels';
import type { PetState } from '../../sim/types';

function pet(partial: Partial<PetState>): PetState {
  return partial as PetState;
}

it('does not pay the starting level or the adoption stage', () => {
  const fresh = pet({ xp: 0, ageDays: 0, lastPaidLevel: 1, lastPaidStage: 'puppy' });
  expect(levelsToPay(fresh)).toEqual([]);
  expect(stagesToPay(fresh)).toEqual([]);
});

it('pays every skipped level and every skipped stage', () => {
  const jumped = pet({ xp: 50, ageDays: 12, lastPaidLevel: 1, lastPaidStage: 'puppy' });
  expect(levelsToPay(jumped)).toEqual([2, 3]);
  expect(stagesToPay(jumped)).toEqual(['olderPuppy', 'adolescent', 'adult']);
});

it('pays nothing again once the current level and stage are recorded', () => {
  const current = pet({ xp: 50, ageDays: 12, lastPaidLevel: 3, lastPaidStage: 'adult' });
  expect(levelsToPay(current)).toEqual([]);
  expect(stagesToPay(current)).toEqual([]);
});
