import { testPet } from '../../sim/__fixtures__/pets';
import { treatProgressPreview } from '../../sim/training';
import { missCopy } from '../trainingResult';

it('rotates miss copy without repeating the line just shown', () => {
  const first = missCopy(0, 'Cat', 'High five');
  const second = missCopy(1, 'Cat', 'High five');
  const third = missCopy(2, 'Cat', 'High five');
  const fourth = missCopy(3, 'Cat', 'High five');
  expect(first.title).not.toBe(second.title);
  expect(second.title).not.toBe(third.title);
  expect(fourth).toEqual(first);
  expect(first.body).toContain('Cat');
  expect(first.body).toContain('High five');
});

it('previews the treat bonus from the room left on the trick', () => {
  const pet = testPet(1, 'retriever', 0, 'Pup', 'pet');
  const track = pet.training.sit;
  if (!track) {
    throw new Error('sit');
  }
  pet.training = { ...pet.training, sit: { ...track, progress: 96, unlocked: true, mastered: false } };
  const preview = treatProgressPreview(pet, 'sit');
  expect(preview).toBeGreaterThan(0);
  expect(preview).toBeLessThanOrEqual(4);
  expect(treatProgressPreview({ ...pet, training: { ...pet.training, sit: { ...track, mastered: true } } }, 'sit')).toBe(0);
});
