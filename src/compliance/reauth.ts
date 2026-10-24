import { Alert } from 'react-native';

import { clearAgeGateStorage } from '../age/storage';
import { readSyncedRevision, setAccountLinked } from '../db/accountMeta';
import { wipeLocalData } from '../db/bootstrap';
import { setCurrentOwner } from '../db/currentOwner';
import { claimDevice } from '../sync/activeDevice';
import { kick } from '../sync/queue';
import { reconcileFromServer } from '../sync/reconcile';
import { requestAgeGateRefresh } from '../state/ageGateRefresh';
import { authTransition, prepareInstalledPet, setAuthTransition, settleUnderLock } from '../state/sessionGate';
import { requireHandleNow } from './handlePrompt';
import { getCachedInstallId, getCachedUserId, setCachedUserId } from './identity';
import { pingAuthHealth } from './authHealth';
import { getSupabase } from './supabase';
import type { AuthCredential } from './appleCredential';

export type RefreshRecovery = { kind: 'offline' } | { kind: 'later' } | { kind: 'dead' } | { kind: 'restored'; userId: string };

let retryOnForeground = false;
let recovering = false;

export function refreshRetryIsDue(): boolean {
  return retryOnForeground;
}

export function noteRefreshRetry(): void {
  retryOnForeground = true;
}

export function clearRefreshRetry(): void {
  retryOnForeground = false;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDeadRefresh(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return true;
  }
  const code = error.code ?? '';
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found') {
    return true;
  }
  const message = error.message ?? '';
  return /refresh token/i.test(message) || /session missing/i.test(message);
}

export async function recoverLinkedSession(): Promise<RefreshRecovery> {
  if (recovering) {
    return { kind: 'later' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { kind: 'offline' };
  }
  recovering = true;
  try {
    const waits = [0, 1000, 2000];
    for (const wait of waits) {
      if (wait > 0) {
        await pause(wait);
      }
      if (!(await pingAuthHealth())) {
        return { kind: 'offline' };
      }
      const { data, error } = await supabase.auth.refreshSession();
      const userId = data.session?.user.id;
      if (userId) {
        return { kind: 'restored', userId };
      }
      if (isDeadRefresh(error)) {
        return { kind: 'dead' };
      }
    }
    return { kind: 'later' };
  } catch {
    return { kind: 'later' };
  } finally {
    recovering = false;
  }
}

async function signIntoAccount(credential: AuthCredential): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  if (credential.provider === 'apple' && credential.pkceCode) {
    const exchanged = await supabase.auth.exchangeCodeForSession(credential.pkceCode);
    return !exchanged.error;
  }
  if (!credential.idToken) {
    return false;
  }
  const signed = await supabase.auth.signInWithIdToken({
    provider: credential.provider,
    token: credential.idToken,
    nonce: credential.rawNonce ?? undefined,
  });
  return !signed.error;
}

async function removeDeletedPet(userId: string): Promise<void> {
  await wipeLocalData();
  setCachedUserId(userId);
  setCurrentOwner(userId);
  setAccountLinked(true);
  await clearAgeGateStorage();
  requestAgeGateRefresh();
  await prepareInstalledPet();
  requireHandleNow();
  setAuthTransition('idle');
}

export async function signBackIn(credential: AuthCredential, petName: string): Promise<void> {
  const previous = getCachedUserId();
  if (authTransition() === 'idle') {
    setAuthTransition('reconciling');
  }
  const signed = await signIntoAccount(credential);
  const supabase = getSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const userId = data.user?.id ?? null;
  if (!signed || !userId) {
    setAuthTransition('reauth');
    return;
  }
  setCachedUserId(userId);
  if (previous && userId !== previous) {
    Alert.alert('This account was deleted', `This account was deleted on another device. ${petName} on this device will be removed.`, [
      { text: 'OK', onPress: () => void removeDeletedPet(userId) },
    ]);
    return;
  }
  const claim = await claimDevice();
  if (!claim) {
    setAuthTransition('reauth');
    return;
  }
  const install = getCachedInstallId();
  const sameDevice = !claim.active_device_id_before || claim.active_device_id_before === install;
  const newer = claim.server_revision > readSyncedRevision();
  if (sameDevice && !newer) {
    setAuthTransition('idle');
    kick(true);
    return;
  }
  setAuthTransition('reconciling');
  await reconcileFromServer(claim);
  settleUnderLock();
  setAuthTransition('idle');
}
