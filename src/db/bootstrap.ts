import AsyncStorage from '@react-native-async-storage/async-storage';

import { getOrCreateInstallId, peekSessionUserId, setCachedUserId } from '../compliance/identity';
import { bindInstallToAuth } from './bindOwner';
import { markOwnerReady, setCurrentOwner } from './currentOwner';
import { getDb, takeAsyncWipe } from './database';

const dataDeletes = [
  'DELETE FROM transaction_lines',
  'DELETE FROM transactions',
  'DELETE FROM balances',
  'DELETE FROM inventory',
  'DELETE FROM owner_state',
  'DELETE FROM daily_counters',
  'DELETE FROM pet',
  'DELETE FROM retired_pets',
  'DELETE FROM owned_toys',
  'DELETE FROM owned_furniture',
  'DELETE FROM home_layouts',
  'DELETE FROM push_queue',
  "DELETE FROM meta WHERE key != 'storageVersion'",
];

export async function wipeAsyncPlayerData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const drop = keys.filter(
    (key) =>
      key === 'petty.pet' ||
      key === 'petty.draft' ||
      key.startsWith('petty.playdates.') ||
      key.startsWith('petty.wardrobe.') ||
      key.startsWith('petty.economy.'),
  );
  if (drop.length > 0) {
    await AsyncStorage.multiRemove(drop);
  }
}

export async function wipeLocalData(): Promise<void> {
  const database = getDb();
  database.execSync(dataDeletes.join(';'));
  await wipeAsyncPlayerData();
}

let pending: Promise<void> | null = null;

async function run(): Promise<void> {
  const wiped = takeAsyncWipe();
  if (wiped) {
    await wipeAsyncPlayerData();
  }
  const installId = await getOrCreateInstallId();
  const sessionId = await peekSessionUserId();
  if (sessionId) {
    await bindInstallToAuth(installId, sessionId);
    setCachedUserId(sessionId);
    setCurrentOwner(sessionId);
  } else {
    setCachedUserId(null);
    setCurrentOwner(installId);
  }
  markOwnerReady();
}

export function bootstrapLocal(): Promise<void> {
  if (!pending) {
    pending = run();
  }
  return pending;
}
