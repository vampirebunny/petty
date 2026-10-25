import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'petty.friends.pendingAdd';

export async function savePendingAdd(handle: string): Promise<void> {
  await AsyncStorage.setItem(key, handle);
}

export async function readPendingAdd(): Promise<string | null> {
  const value = await AsyncStorage.getItem(key);
  return value && value.length > 0 ? value : null;
}

export async function clearPendingAdd(): Promise<void> {
  await AsyncStorage.removeItem(key);
}
