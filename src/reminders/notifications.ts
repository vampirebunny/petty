import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { PetState } from '../sim/types';
import { nextReminder, reminderCopy } from './nextReminder';

let handlerReady = false;

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

export async function syncReminder(pet: PetState, enabled: boolean, now = Date.now()): Promise<boolean> {
  if (Platform.OS === 'web') {
    return enabled;
  }
  try {
    ensureHandler();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) {
      return false;
    }
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
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
    const reminder = nextReminder(pet, now);
    if (reminder == null) {
      return true;
    }
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
    return true;
  } catch {
    return enabled;
  }
}
