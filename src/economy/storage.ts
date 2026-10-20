import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyEconomy, settleEconomy, type UserEconomy } from './state';

function keyFor(ownerId: string): string {
  return `petty.economy.${ownerId}`;
}

function isEconomy(value: unknown): value is UserEconomy {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const raw = value as UserEconomy;
  return Array.isArray(raw.inventory) && typeof raw.lastTreatRegenAt === 'number';
}

export async function loadEconomy(ownerId: string, now = Date.now()): Promise<UserEconomy> {
  const raw = await AsyncStorage.getItem(keyFor(ownerId));
  if (!raw) {
    return settleEconomy(emptyEconomy(now), now);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEconomy(parsed) ? settleEconomy(parsed, now) : settleEconomy(emptyEconomy(now), now);
  } catch {
    return settleEconomy(emptyEconomy(now), now);
  }
}

export async function saveEconomy(ownerId: string, economy: UserEconomy): Promise<void> {
  await AsyncStorage.setItem(keyFor(ownerId), JSON.stringify(economy));
}
