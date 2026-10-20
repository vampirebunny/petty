import { advanceNeeds } from '../sim/advance';
import { dayMs, highHungerThreshold, lowEnergyThreshold, stepMs } from '../sim/config';
import type { PetState } from '../sim/types';

export type ReminderKind = 'meal' | 'rest' | 'training' | 'treats';

export type Reminder = {
  at: number;
  kind: ReminderKind;
};

const searchLimitMs = 7 * dayMs;

export function reminderCopy(name: string, kind: ReminderKind): string {
  if (kind === 'meal') {
    return `${name} could use a meal.`;
  }
  if (kind === 'training') {
    return `${name} can train again.`;
  }
  if (kind === 'treats') {
    return `Treats are full again.`;
  }
  return `${name} could use a rest.`;
}

export function nextReminder(state: PetState, now: number): Reminder | null {
  const steps = Math.floor(searchLimitMs / stepMs);
  let cursor = state;
  let mealArmed = state.needs.hunger <= highHungerThreshold;
  let restArmed = state.needs.energy >= lowEnergyThreshold;
  let mealAt: number | null = null;
  let restAt: number | null = null;
  const since = Math.max(0, now - state.lastUpdatedAt);
  const intoStep = since % stepMs;
  const firstDelay = intoStep === 0 ? stepMs : stepMs - intoStep;

  for (let step = 1; step <= steps; step += 1) {
    const next = advanceNeeds(cursor, stepMs, true);
    const at = now + firstDelay + (step - 1) * stepMs;
    if (mealArmed && cursor.needs.hunger <= highHungerThreshold && next.needs.hunger > highHungerThreshold) {
      mealAt = at;
      mealArmed = false;
    } else if (!mealArmed && next.needs.hunger <= highHungerThreshold) {
      mealArmed = true;
    }
    if (restArmed && cursor.needs.energy >= lowEnergyThreshold && next.needs.energy < lowEnergyThreshold) {
      restAt = at;
      restArmed = false;
    } else if (!restArmed && next.needs.energy >= lowEnergyThreshold) {
      restArmed = true;
    }
    cursor = next;
    if (mealAt != null && restAt != null) {
      break;
    }
  }

  if (mealAt == null && restAt == null) {
    return null;
  }
  if (mealAt == null) {
    return { at: restAt as number, kind: 'rest' };
  }
  if (restAt == null || mealAt <= restAt) {
    return { at: mealAt, kind: 'meal' };
  }
  return { at: restAt, kind: 'rest' };
}

const reminderPriority: ReminderKind[] = ['meal', 'rest', 'training', 'treats'];

export function shiftQuietHours(at: number): number {
  const date = new Date(at);
  const hour = date.getHours();
  if (hour < 8 || hour >= 21) {
    if (hour >= 21) {
      date.setDate(date.getDate() + 1);
    }
    date.setHours(8, 0, 0, 0);
    return date.getTime();
  }
  return at;
}

export function planReminders(
  state: PetState,
  now: number,
  options: { reminders: boolean; care: boolean; basicTreats: number },
): Reminder[] {
  const planned: Reminder[] = [];
  if (options.reminders) {
    const next = nextReminder(state, now);
    if (next) {
      planned.push(next);
    }
  }
  if (options.care && state.care) {
    const capped = Object.values(state.training).some((track) => track.repsToday >= 8);
    if (capped) {
      const day = Math.floor((now - state.bornAt) / dayMs);
      planned.push({ at: state.bornAt + (day + 1) * dayMs, kind: 'training' });
    }
    if (options.basicTreats < 15) {
      planned.push({ at: now + (15 - options.basicTreats) * 20 * 60 * 1000, kind: 'treats' });
    }
  }
  planned.sort((a, b) => reminderPriority.indexOf(a.kind) - reminderPriority.indexOf(b.kind) || a.at - b.at);
  return planned.slice(0, 3).map((item) => ({ ...item, at: shiftQuietHours(item.at) }));
}
