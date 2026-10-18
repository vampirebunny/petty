import { createPet } from '../../sim/createPet';
import { nextReminder, reminderCopy } from '../nextReminder';

const stageWords = ['puppy', 'adolescent', 'adult', 'senior', 'elderly'];

it('uses the pet name and no stage word', () => {
  for (const copy of [reminderCopy('Maple', 'meal'), reminderCopy('Maple', 'rest')]) {
    expect(copy).toContain('Maple');
    for (const word of stageWords) {
      expect(copy.toLowerCase()).not.toContain(word);
    }
  }
  expect(reminderCopy('Maple', 'meal')).toBe('Maple could use a meal.');
  expect(reminderCopy('Maple', 'rest')).toBe('Maple could use a rest.');
});

it('schedules the sooner crossing and waits when a need is already low', () => {
  const pet = createPet(1, 'retriever', 0, 0, 'Maple', 'pet');
  const reminder = nextReminder(pet, 1_000);
  expect(reminder?.kind).toBe('meal');
  expect(reminder && reminder.at).toBeGreaterThan(1_000);

  const hungry = {
    ...pet,
    needs: { ...pet.needs, fullness: 10, energy: 80 },
  };
  expect(nextReminder(hungry, 1_000)?.kind).toBe('rest');

  const low = {
    ...pet,
    needs: { fullness: 10, energy: 10, happiness: 80 },
  };
  expect(nextReminder(low, 1_000)).toBeNull();
});
