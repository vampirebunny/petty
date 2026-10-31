import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { localDay } from '../economy/clock';
import type { PetState } from '../sim/types';
import { nextPushAt, noteAppOpen } from './schedule';
import { loadCounters, saveCounters } from './store';

export const npcInvitePushId = 'npc-invite';

let openedFromPush = false;

export function markInvitePushOpened(): void {
  openedFromPush = true;
}

export async function cancelNpcPush(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(npcInvitePushId);
  } catch {
    // Already fired or never scheduled.
  }
}

function usualHour(now: number): number {
  return new Date(now).getHours();
}

/** Schedules the away push when permission is already granted. Never asks for permission. */
export async function scheduleNpcPush(pet: PetState, now: number): Promise<void> {
  if (Platform.OS === 'web' || !pet.ownerId) {
    return;
  }
  const taken = openedFromPush;
  openedFromPush = false;
  let counters = noteAppOpen(await loadCounters(pet.ownerId), now, taken);
  if (!counters.pushesEnabled) {
    counters = { ...counters, pendingPushAt: null };
    await saveCounters(pet.ownerId, counters);
    return;
  }
  let granted = false;
  try {
    granted = (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    granted = false;
  }
  if (!granted) {
    await saveCounters(pet.ownerId, counters);
    return;
  }
  const at = nextPushAt(now, usualHour(now), counters.unansweredPushes, counters.pushesStopped);
  const pushDay = at == null ? null : localDay(at);
  const blockedToday = pushDay != null && (counters.shownDay === pushDay || counters.friendPushDay === pushDay);
  if (at == null || blockedToday) {
    counters = { ...counters, pendingPushAt: null };
    await saveCounters(pet.ownerId, counters);
    return;
  }
  counters = { ...counters, pendingPushAt: at };
  await saveCounters(pet.ownerId, counters);
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('invites', {
        name: 'Invitations',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: npcInvitePushId,
      content: {
        title: "You're invited!",
        body: `${pet.name} has an invitation waiting.`,
        data: { kind: 'npc_invite' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
        channelId: Platform.OS === 'android' ? 'invites' : undefined,
      },
    });
  } catch {
    // The in-app envelope still works if the push cannot be scheduled.
  }
}
