import { applyRewardTreat } from '../../treats/rules';
import { testPet } from '../__fixtures__/pets';
import { blankTraining } from '../game';
import { payRep } from '../training';
import { masteredTrickIds } from '../tracks';
import { prepareTrickPurchase, trickMilestoneKey } from '../tricks';

it('starts Paw locked and free, and keeps a bought trick', () => {
  const training = blankTraining('dog');
  expect(training.paw?.unlocked).toBe(false);
  expect(training.paw?.source).toBe('starter');
  expect(training.sit?.source).toBe('starter');

  const pup = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const bought = prepareTrickPurchase(pup, 'dog', 'dog_spin', 1000);
  expect(bought.ok).toBe(true);
  if (!bought.ok) {
    return;
  }
  expect(bought.price).toBe(150);
  expect(bought.pet.training.dog_spin).toMatchObject({ source: 'purchase', progress: 0, unlocked: true, mastered: false });
  expect(prepareTrickPurchase(bought.pet, 'dog', 'dog_spin', 1000)).toEqual({ ok: false, reason: 'owned' });
});

it('rejects the wrong species, a young pet, and a short balance', () => {
  const pup = testPet(1, 'retriever', 0, 'Pup', 'pet');
  expect(prepareTrickPurchase(pup, 'dog', 'cat_spin', 1000)).toEqual({ ok: false, reason: 'species' });
  expect(prepareTrickPurchase(pup, 'dog', 'dog_play_dead', 1000)).toEqual({ ok: false, reason: 'age' });
  expect(prepareTrickPurchase(pup, 'dog', 'dog_spin', 10)).toEqual({ ok: false, reason: 'insufficient_boops' });
  expect(prepareTrickPurchase(pup, 'dog', 'nope', 1000)).toEqual({ ok: false, reason: 'unknown' });
});

it('learns a placeholder at the same tier-1 rate and pays its mastery once', () => {
  const pup = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const bought = prepareTrickPurchase(pup, 'dog', 'dog_spin', 1000);
  if (!bought.ok) {
    throw new Error('expected a purchase');
  }
  const sit = payRep(bought.pet, 'sit', 'treat', 1);
  const spin = payRep(bought.pet, 'dog_spin', 'treat', 1);
  expect(spin.training.dog_spin?.progress).toBe(sit.training.sit?.progress);
  expect(spin.training.dog_spin?.progress).toBeGreaterThan(0);

  const mastered = {
    ...spin,
    milestones: [...spin.milestones, 'dog_spin'],
    training: {
      ...spin.training,
      dog_spin: { ...spin.training.dog_spin!, mastered: true, progress: 100 },
    },
  };
  expect(masteredTrickIds(mastered)).toContain('dog_spin');
  expect(trickMilestoneKey(mastered.id, 'dog_spin')).toBe('milestone:trick:dog_spin:pet');
  expect(masteredTrickIds(mastered).filter((id) => id === 'dog_spin')).toEqual(['dog_spin']);
});

it('applies the school biscuit reward on the pet alone', () => {
  const pup = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const paid = applyRewardTreat(pup, 'biscuit', 1);
  expect(paid.ok).toBe(true);
  if (!paid.ok) {
    return;
  }
  expect(paid.state.needs.happiness).toBeGreaterThanOrEqual(pup.needs.happiness);
  expect(paid.state.training).toEqual(pup.training);
});
