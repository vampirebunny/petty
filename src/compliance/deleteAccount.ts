import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { readAccountLinked } from '../db/accountMeta';
import { authTransition, setAuthTransition } from '../state/sessionGate';
import { fullAccountWipe } from './accountWipe';
import { pingAuthHealth } from './authHealth';
import { peekSessionUserId } from './identity';
import { deleteGuestAccount } from './syncConsentRecords';
import { getSupabase } from './supabase';

const pendingKey = 'boop.pendingSupersede';

export type DeleteResult =
  | { ok: true }
  | { ok: false; needsApple: true }
  | { ok: false; offline: true }
  | { ok: false; message: string };

type Options = {
  skipApple?: boolean;
  authorizationCode?: string;
};

function failed(message: string): DeleteResult {
  setAuthTransition('idle');
  return { ok: false, message };
}

function payloadOf(data: unknown): { ok?: boolean; error?: string; needs_apple_reauth?: boolean } | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  return data as { ok?: boolean; error?: string; needs_apple_reauth?: boolean };
}

/** Deletes the signed-in account, or wipes a guest that never reached the server. */
export async function runAccountDeletion(options: Options = {}): Promise<DeleteResult> {
  const linked = readAccountLinked();
  const sessionId = await peekSessionUserId();
  if (!linked && !sessionId) {
    const wiped = await fullAccountWipe();
    return wiped ? { ok: true } : failed("Couldn't delete just now.");
  }
  if (authTransition() === 'idle') {
    setAuthTransition('deleting');
  }
  const online = await pingAuthHealth();
  if (!online) {
    setAuthTransition('idle');
    return { ok: false, offline: true };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return failed("Couldn't delete just now.");
  }
  const token = await SecureStore.getItemAsync(pendingKey).catch(() => null);
  const invoke = (skipApple: boolean, authorizationCode?: string) =>
    supabase.functions.invoke('delete_account', {
      body: {
        ...(authorizationCode ? { authorizationCode } : {}),
        p_skip_apple_revoke: skipApple,
        ...(token ? { guest_access_token: token } : {}),
      },
    });

  let skipApple = options.skipApple === true;
  let response = await invoke(skipApple, options.authorizationCode);
  let payload = payloadOf(response.data);
  if (!response.error && payload?.needs_apple_reauth && Platform.OS === 'android' && !skipApple) {
    skipApple = true;
    response = await invoke(true);
    payload = payloadOf(response.data);
  }
  if (!response.error && payload?.needs_apple_reauth) {
    if (skipApple) {
      return failed("Couldn't delete just now.");
    }
    return { ok: false, needsApple: true };
  }
  if (response.error || !payload?.ok) {
    const message = payload?.error || response.error?.message || "Couldn't delete just now.";
    return failed(message);
  }
  await SecureStore.deleteItemAsync(pendingKey).catch(() => undefined);
  const wiped = await fullAccountWipe();
  return wiped ? { ok: true } : failed("Couldn't delete just now.");
}

/**
 * Under-13 deletion. Linked accounts skip Apple revoke and never ask again.
 * A guest that never synced wipes locally. Offline returns false and deletes nothing.
 */
export async function eraseUnder13(): Promise<boolean> {
  const linked = readAccountLinked();
  const sessionId = await peekSessionUserId();
  if (!sessionId && !linked) {
    return fullAccountWipe();
  }
  const online = await pingAuthHealth();
  if (!online) {
    return false;
  }
  if (linked) {
    const result = await runAccountDeletion({ skipApple: true });
    return result.ok;
  }
  const guest = await deleteGuestAccount();
  if (!guest) {
    return false;
  }
  return fullAccountWipe();
}
