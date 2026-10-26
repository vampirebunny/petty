import * as SecureStore from 'expo-secure-store';

import { clearAgeGateStorage } from '../age/storage';
import { readAccountLinked, setStandby } from '../db/accountMeta';
import { wipeLocalData } from '../db/bootstrap';
import { setCurrentOwner } from '../db/currentOwner';
import { cancelReminders } from '../reminders/notifications';
import { clearFriendCache } from '../friends/api';
import { clearPendingAdd } from '../friends/pendingAdd';
import { clearFriendPromptStorage } from '../friends/prompt';
import { unregisterFriendPushToken } from '../friends/push';
import { requestAgeGateRefresh } from '../state/ageGateRefresh';
import { authTransition, holdWelcome, prepareInstalledPet, setAuthTransition } from '../state/sessionGate';
import { rotateInstallId, setCachedUserId } from './identity';
import { clearPendingInstall, supersedePendingGuest } from './restoreAccount';
import { getSupabase } from './supabase';

const pendingKey = 'boop.pendingSupersede';
const guestSessionKey = 'boop.guestSession';

type WipeListener = () => void;

const wipedListeners = new Set<WipeListener>();

export function onLocalWiped(listener: WipeListener): () => void {
  wipedListeners.add(listener);
  return () => {
    wipedListeners.delete(listener);
  };
}

/**
 * Full local wipe after a delete. A pending guest is superseded first; a failed
 * supersede stops the wipe and leaves the token in place. Keeps storageVersion.
 */
export async function fullAccountWipe(): Promise<boolean> {
  if (authTransition() === 'idle') {
    setAuthTransition('deleting');
  }
  const token = await SecureStore.getItemAsync(pendingKey).catch(() => null);
  if (token) {
    const superseded = await supersedePendingGuest();
    if (!superseded) {
      setAuthTransition('idle');
      return false;
    }
  }
  holdWelcome();
  clearPendingInstall();
  setStandby(false);
  await wipeLocalData();
  setCachedUserId(null);
  await clearAgeGateStorage();
  await SecureStore.deleteItemAsync(guestSessionKey).catch(() => undefined);
  await SecureStore.deleteItemAsync(pendingKey).catch(() => undefined);
  await cancelReminders().catch(() => undefined);
  await unregisterFriendPushToken().catch(() => undefined);
  await clearFriendCache().catch(() => undefined);
  await clearFriendPromptStorage().catch(() => undefined);
  await clearPendingAdd().catch(() => undefined);
  try {
    await getSupabase()?.auth.signOut({ scope: 'local' });
  } catch {
    // Local keys are already gone. Welcome still starts clean.
  }
  const installId = await rotateInstallId();
  setCurrentOwner(installId);
  await prepareInstalledPet();
  requestAgeGateRefresh();
  for (const listener of wipedListeners) {
    listener();
  }
  setAuthTransition('idle');
  return true;
}

/** Signs this phone out and wipes local progress. Does not call delete_account. */
export async function logOutOfAccount(): Promise<boolean> {
  if (!readAccountLinked()) {
    return false;
  }
  return fullAccountWipe();
}
