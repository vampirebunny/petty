import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { getSupabase } from '../compliance/supabase';
import { currentOwner } from '../db/currentOwner';
import { localDay } from '../economy/clock';
import { markInvitePushOpened } from '../invites/push';
import { requestNpcInvite } from '../invites/session';
import { updateCounters } from '../invites/store';
import { requestFriendCall, requestGate } from '../stadium/raceCall';
import { requestFriendAcceptNotice, requestFriendAcceptOpen, requestFriendGame, requestFriendModal, requestRunwayNotice, requestRunwayShow } from './open';
import { foregroundNotificationBehavior } from './present';

const tokenKey = 'petty.friends.pushToken';

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerFriendPushToken(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    return;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('friends', {
      name: 'Friends',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const id = projectId();
  const token = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
  await AsyncStorage.setItem(tokenKey, token.data);
  await supabase.rpc('register_push_token', {
    p_token: token.data,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
}

export async function unregisterFriendPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(tokenKey);
  const supabase = getSupabase();
  if (token && supabase) {
    const removed = await supabase.rpc('unregister_push_token', { p_token: token });
    if (removed.error) {
      // The session may already be gone. The token row is removed with the account.
    }
  }
  await AsyncStorage.removeItem(tokenKey);
}

export async function requestFriendPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  const current = await Notifications.getPermissionsAsync();
  const requested = await Notifications.requestPermissionsAsync();
  if (current.status === 'undetermined') {
    const { track } = await import('../analytics/analytics');
    track('notif_permission', { context: 'friends', granted: requested.status === 'granted' ? 1 : 0 });
  }
  if (requested.status !== 'granted') {
    return false;
  }
  await registerFriendPushToken();
  return true;
}

type PushData = { kind?: string; raceId?: string; showId?: string; joined?: unknown };

function pushData(notification: Notifications.Notification): PushData | undefined {
  const data = notification.request.content.data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  return data as PushData;
}

/** Foreground pushes are discarded unless a handler answers. Accept notices stay in-app. */
function presentWhileOpen(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => foregroundNotificationBehavior(notification),
  });
}

function joinedOf(data: PushData | undefined): boolean {
  return data?.joined === true || data?.joined === 'true' || data?.joined === 1;
}

function acceptMessage(notification: Notifications.Notification): string {
  const body = notification.request.content.body;
  return typeof body === 'string' && body.trim().length > 0 ? body : 'A friend joined the game!';
}

function noteFriendPush(): void {
  try {
    const ownerId = currentOwner();
    void updateCounters(ownerId, (counters) => ({ ...counters, friendPushDay: localDay(Date.now()) })).catch(() => undefined);
  } catch {
    // The owner id is not ready yet. The next friend push can record the day.
  }
}

function openFriendPush(data: PushData | undefined): void {
  if (
    data?.kind === 'friend_request' ||
    data?.kind === 'friend_game' ||
    data?.kind === 'runway_show' ||
    data?.kind === 'runway_submitted' ||
    data?.kind === 'runway_vote' ||
    data?.kind === 'runway_results'
  ) {
    noteFriendPush();
  }
  if (data?.kind === 'friend_request') {
    requestFriendModal();
  }
  if (data?.kind === 'friend_game') {
    requestFriendGame(typeof data.raceId === 'string' ? data.raceId : null);
  }
  if (
    data?.kind === 'runway_show' ||
    data?.kind === 'runway_submitted' ||
    data?.kind === 'runway_vote' ||
    data?.kind === 'runway_results'
  ) {
    requestRunwayShow(typeof data.showId === 'string' ? data.showId : null);
  }
}

let listenerReady = false;

export function listenForFriendPushes(): void {
  if (listenerReady || Platform.OS === 'web') {
    return;
  }
  listenerReady = true;
  presentWhileOpen();
  const open = (response: Notifications.NotificationResponse) => {
    const data = pushData(response.notification);
    if (data?.kind === 'npc_invite') {
      markInvitePushOpened();
      requestNpcInvite();
      return;
    }
    if (data?.kind === 'friend_game_call') {
      requestFriendCall(typeof data.raceId === 'string' ? data.raceId : null);
      return;
    }
    if (data?.kind === 'friend_game_accepted') {
      noteFriendPush();
      const raceId = typeof data.raceId === 'string' ? data.raceId : '';
      if (raceId) requestFriendAcceptOpen({ raceId, joined: joinedOf(data) });
      return;
    }
    openFriendPush(data);
    if (data?.kind === 'race') {
      requestGate(typeof data.raceId === 'string' ? data.raceId : null);
    }
  };
  Notifications.addNotificationResponseReceivedListener(open);
  Notifications.addNotificationReceivedListener((notification) => {
    const data = pushData(notification);
    if (data?.kind === 'npc_invite') {
      return;
    }
    if (data?.kind === 'friend_game_accepted') {
      if (AppState.currentState !== 'active') return;
      const raceId = typeof data.raceId === 'string' ? data.raceId : '';
      if (!raceId) return;
      noteFriendPush();
      requestFriendAcceptNotice({ raceId, message: acceptMessage(notification), joined: joinedOf(data) });
      return;
    }
    if (
      data?.kind === 'runway_show' ||
      data?.kind === 'runway_submitted' ||
      data?.kind === 'runway_vote' ||
      data?.kind === 'runway_results'
    ) {
      if (AppState.currentState !== 'active') return;
      const showId = typeof data.showId === 'string' ? data.showId : '';
      if (!showId) return;
      noteFriendPush();
      const body = notification.request.content.body;
      const message = typeof body === 'string' && body.trim().length > 0 ? body : 'A fashion show is ready.';
      requestRunwayNotice({ showId, message });
      return;
    }
    openFriendPush(data);
  });
  const launched = Notifications.getLastNotificationResponse();
  if (launched) {
    Notifications.clearLastNotificationResponse();
    open(launched);
  }
}
