import { advanceNeeds } from '../sim/advance';
import { dayMs, lowEnergyThreshold, lowFullnessThreshold, stepMs } from '../sim/config';
import type { PetState } from '../sim/types';

export type ReminderKind = 'meal' | 'rest';

export type Reminder = {
  at: number;
  kind: ReminderKind;
};

const searchLimitMs = 7 * dayMs;

export function reminderCopy(name: string, kind: ReminderKind): string {
  if (kind === 'meal') {
    return `${name} could use a meal.`;
  }
  return `${name} could use a rest.`;
}

export function nextReminder(state: PetState, now: number): Reminder | null {
  const steps = Math.floor(searchLimitMs / stepMs);
  let cursor = state;
  let mealArmed = state.needs.fullness >= lowFullnessThreshold;
  let restArmed = state.needs.energy >= lowEnergyThreshold;
  let mealAt: number | null = null;
  let restAt: number | null = null;
  const since = Math.max(0, now - state.lastUpdatedAt);
  const intoStep = since % stepMs;
  const firstDelay = intoStep === 0 ? stepMs : stepMs - intoStep;

  for (let step = 1; step <= steps; step += 1) {
    const next = advanceNeeds(cursor, stepMs, true);
    const at = now + firstDelay + (step - 1) * stepMs;
    if (mealArmed && cursor.needs.fullness >= lowFullnessThreshold && next.needs.fullness < lowFullnessThreshold) {
      mealAt = at;
      mealArmed = false;
    } else if (!mealArmed && next.needs.fullness >= lowFullnessThreshold) {
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
