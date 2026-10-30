import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase } from '../compliance/supabase';
import { requestGate } from '../stadium/raceCall';
import { requestFriendGame, requestFriendModal } from './open';

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
  const requested = await Notifications.requestPermissionsAsync();
  if (requested.status !== 'granted') {
    return false;
  }
  await registerFriendPushToken();
  return true;
}

type PushData = { kind?: string; raceId?: string };

function pushData(notification: Notifications.Notification): PushData | undefined {
  const data = notification.request.content.data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  return data as PushData;
}

/** Foreground pushes are discarded unless a handler answers. Same presentation as care reminders. */
function presentWhileOpen(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function openFriendPush(data: PushData | undefined): void {
  if (data?.kind === 'friend_request') {
    requestFriendModal();
  }
  if (data?.kind === 'friend_game') {
    requestFriendGame(typeof data.raceId === 'string' ? data.raceId : null);
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
    openFriendPush(data);
    if (data?.kind === 'race') {
      requestGate(typeof data.raceId === 'string' ? data.raceId : null);
    }
  };
  Notifications.addNotificationResponseReceivedListener(open);
  Notifications.addNotificationReceivedListener((notification) => {
    openFriendPush(pushData(notification));
  });
  const launched = Notifications.getLastNotificationResponse();
  if (launched) {
    Notifications.clearLastNotificationResponse();
    open(launched);
  }
}
