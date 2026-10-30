import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { readServerOffsetMs } from '../db/accountMeta';
import type { PetState } from '../sim/types';
import { gameplayConfig } from '../sim/gameplayConfig';
import { eventLabel, raceReminderAt, racesOf } from '../sim/stadium';
import { planReminders, reminderCopy } from './nextReminder';
import { track } from '../analytics/analytics';

let handlerReady = false;
const raceCallId = 'race-call';

function ensureHandler(): void {
  if (handlerReady) {
    return;
  }
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function cancelReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to cancel, or notifications are unavailable.
  }
}

export async function cancelRaceCall(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(raceCallId);
  } catch {
    // Already fired or never scheduled.
  }
}

export async function askRaceReminderPermission(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    ensureHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted' || current.status === 'denied') {
      return;
    }
    const requested = await Notifications.requestPermissionsAsync();
    track('notif_permission', { context: 'race', granted: requested.status === 'granted' ? 1 : 0 });
  } catch {
    // The race still starts if notifications stay off.
  }
}

export async function syncReminder(
  pet: PetState,
  enabled: boolean,
  now = Date.now(),
  care: { enabled: boolean; basicTreats: number } = { enabled: false, basicTreats: 0 },
  ask = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return enabled;
  }
  try {
    ensureHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const raceDue = raceReminderAt(pet, now + readServerOffsetMs()) != null;
    if (!enabled && !care.enabled && !raceDue) {
      return false;
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      if (!ask || status === 'denied') {
        return status === 'denied' ? false : enabled;
      }
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      track('notif_permission', { context: 'care', granted: status === 'granted' ? 1 : 0 });
    }
    if (status !== 'granted') {
      return false;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('care', {
        name: 'Care',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const signup = racesOf(pet).signup;
    const offset = readServerOffsetMs();
    const raceAt = raceReminderAt(pet, now + offset);
    if (signup && raceAt != null) {
      await Notifications.scheduleNotificationAsync({
        identifier: raceCallId,
        content: {
          title: `${pet.name}'s race starts in ${Math.round(gameplayConfig.races.callMs / 1000)} seconds! 🏁`,
          body: `${eventLabel(signup.event)} is about to begin. Tap to head to the Stadium.`,
          data: { kind: 'race', entryId: signup.entryId, raceId: signup.raceId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(raceAt - offset),
          channelId: Platform.OS === 'android' ? 'care' : undefined,
        },
      });
    }
    if (!enabled && !care.enabled) {
      return false;
    }
    const reminders = planReminders(pet, now, { reminders: enabled, care: care.enabled, basicTreats: care.basicTreats });
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: pet.name,
          body: reminderCopy(pet.name, reminder.kind),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.at),
          channelId: Platform.OS === 'android' ? 'care' : undefined,
        },
      });
    }
    return true;
  } catch {
    return enabled;
  }
}
