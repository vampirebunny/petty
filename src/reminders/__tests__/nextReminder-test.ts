import { testPet } from '../../sim/__fixtures__/pets';
import { nextReminder, planReminders, reminderCopy } from '../nextReminder';

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
  const pet = testPet(1, 'retriever', 0, 'Maple', 'pet');
  const reminder = nextReminder(pet, 1_000);
  expect(reminder?.kind).toBe('meal');
  expect(reminder && reminder.at).toBeGreaterThan(1_000);

  const hungry = {
    ...pet,
    needs: { ...pet.needs, hunger: 90, energy: 80 },
  };
  expect(nextReminder(hungry, 1_000)?.kind).toBe('rest');

  const low = {
    ...pet,
    needs: { hunger: 90, energy: 10, happiness: 80 },
  };
  expect(nextReminder(low, 1_000)).toBeNull();
});

it('reminds when a trick rest ends and does not remind about treat regen', () => {
  const pet = testPet(1, 'retriever', 0, 'Maple', 'pet');
  const now = Date.UTC(2026, 9, 21, 12, 0, 0);
  const restUntil = now + 10 * 60 * 1000;
  const resting = {
    ...pet,
    training: {
      ...pet.training,
      sit: { ...pet.training.sit!, restUntil, focusUsed: 5, hadNoTreat: false },
    },
  };
  const planned = planReminders(resting, now, { reminders: false, care: true, basicTreats: 0 });
  expect(planned.some((item) => item.kind === 'treats')).toBe(false);
  expect(planned.find((item) => item.kind === 'training')?.at).toBe(restUntil);
});
