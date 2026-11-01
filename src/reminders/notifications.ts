import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { readServerOffsetMs } from '../db/accountMeta';
import type { PetState } from '../sim/types';
import { gameplayConfig } from '../sim/gameplayConfig';
import { eventLabel, raceReminderAt, upcomingRaceCall, type RaceCall } from '../sim/stadium';
import { foregroundNotificationBehavior } from '../friends/present';
import { planReminders, reminderCopy } from './nextReminder';
import { track } from '../analytics/analytics';
import { scheduleNpcPush } from '../invites/push';

let handlerReady = false;
const raceCallId = 'race-call';

function ensureHandler(): void {
  if (handlerReady) {
    return;
  }
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => foregroundNotificationBehavior(notification),
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

function raceCallNotification(pet: PetState, call: RaceCall) {
  const event = call.kind === 'signup' ? call.signup.event : call.call.event;
  const data =
    call.kind === 'signup'
      ? { kind: 'race', entryId: call.signup.entryId, raceId: call.signup.raceId }
      : { kind: 'friend_game_call', raceId: call.call.raceId };
  return {
    title: `${pet.name}'s race starts in ${Math.round(gameplayConfig.races.callMs / 1000)} seconds! 🏁`,
    body: `${eventLabel(event)} is about to begin. Tap to head to the Stadium.`,
    data,
  };
}

/** Schedules or clears only the gate reminder. Care reminders stay as they are. */
export async function scheduleRaceCall(pet: PetState, now = Date.now()): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    const offset = readServerOffsetMs();
    const call = upcomingRaceCall(pet, now + offset);
    if (!call) {
      await cancelRaceCall();
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted') {
      return;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: raceCallId,
      content: raceCallNotification(pet, call),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(call.at - offset),
        channelId: Platform.OS === 'android' ? 'care' : undefined,
      },
    });
  } catch {
    // The in-app gate call still shows if the local notification cannot be scheduled.
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
    const finish = async (value: boolean) => {
      await scheduleNpcPush(pet, now);
      return value;
    };
    const raceDue = raceReminderAt(pet, now + readServerOffsetMs()) != null;
    if (!enabled && !care.enabled && !raceDue) {
      return finish(false);
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      if (!ask || status === 'denied') {
        return finish(status === 'denied' ? false : enabled);
      }
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      track('notif_permission', { context: 'care', granted: status === 'granted' ? 1 : 0 });
    }
    if (status !== 'granted') {
      return finish(false);
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('care', {
        name: 'Care',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const offset = readServerOffsetMs();
    const call = upcomingRaceCall(pet, now + offset);
    if (call) {
      await Notifications.scheduleNotificationAsync({
        identifier: raceCallId,
        content: raceCallNotification(pet, call),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(call.at - offset),
          channelId: Platform.OS === 'android' ? 'care' : undefined,
        },
      });
    }
    if (!enabled && !care.enabled) {
      return finish(false);
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
    return finish(true);
  } catch {
    return enabled;
  }
}
