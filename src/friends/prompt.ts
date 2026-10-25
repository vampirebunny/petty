import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const declinedKey = 'petty.friends.promptDeclinedAt';
const seenKey = 'petty.friends.seenAt';
const momentKey = {
  send: 'petty.friends.prompt.send',
  accept: 'petty.friends.prompt.accept',
  settings: 'petty.friends.prompt.settings',
} as const;

const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

export type PromptMoment = keyof typeof momentKey;

export async function friendPromptShouldShow(moment: PromptMoment): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  const declined = await AsyncStorage.getItem(declinedKey);
  if (declined && Date.now() - Number(declined) < twoWeeksMs) {
    return false;
  }
  const used = await AsyncStorage.getItem(momentKey[moment]);
  if (used) {
    return false;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'undetermined') {
    return false;
  }
  await AsyncStorage.setItem(momentKey[moment], '1');
  return true;
}

export async function rememberFriendPromptDecline(): Promise<void> {
  await AsyncStorage.setItem(declinedKey, String(Date.now()));
}

export async function readFriendSeenAt(): Promise<string | null> {
  return AsyncStorage.getItem(seenKey);
}

export async function writeFriendSeenAt(createdAt: string): Promise<void> {
  await AsyncStorage.setItem(seenKey, createdAt);
}

export function newestRequestAt(createdAts: (string | undefined)[]): string | null {
  const stamps = createdAts.filter((value): value is string => Boolean(value));
  if (stamps.length === 0) {
    return null;
  }
  return stamps.reduce((latest, value) => (value > latest ? value : latest));
}

export async function clearFriendPromptStorage(): Promise<void> {
  await AsyncStorage.multiRemove([declinedKey, seenKey, momentKey.send, momentKey.accept, momentKey.settings]);
}
