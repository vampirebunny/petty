import { setAccountLinked, setAppleTokenMissing, setHandleSaved } from '../db/accountMeta';
import { authTransition, setAuthTransition } from '../state/sessionGate';
import { claimDevice } from '../sync/activeDevice';
import type { AuthCredential } from './appleCredential';
import { getSupabase } from './supabase';
import { finishHandlePrompt, requireHandleNow } from './handlePrompt';

export type LinkResult =
  | { ok: true; needsHandle: boolean }
  | {
      ok: false;
      reason: 'already_linked';
      sessionReady: boolean;
      providerRefreshToken?: string;
    }
  | { ok: false; reason: 'failed'; message: string };

const failedMessage = "We couldn't sign you in. Try again.";

export function isAlreadyLinkedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /already linked/i.test(message);
}

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function storeAppleToken(body: {
  authorizationCode?: string;
  refresh_token?: string;
}): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.functions.invoke('apple_store_token', { body });
    const saved = data && typeof data === 'object' && 'ok' in data && data.ok === true;
    if (!error && saved) {
      return true;
    }
    await pause(400 * (attempt + 1));
  }
  return false;
}

export async function linkGuest(credential: AuthCredential): Promise<LinkResult> {
  if (authTransition() !== 'idle') {
    return { ok: false, reason: 'failed', message: failedMessage };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, reason: 'failed', message: failedMessage };
  }
  setAuthTransition('linking');
  try {
    let refreshToken = credential.providerRefreshToken;
    if (credential.provider === 'apple' && credential.pkceCode) {
      const { data: prior } = await supabase.auth.getSession();
      const priorSession = prior.session;
      const exchanged = await supabase.auth.exchangeCodeForSession(credential.pkceCode);
      if (exchanged.error) {
        if (isAlreadyLinkedError(exchanged.error)) {
          return { ok: false, reason: 'already_linked', sessionReady: false };
        }
        return { ok: false, reason: 'failed', message: failedMessage };
      }
      const nextId = exchanged.data.user?.id;
      if (priorSession && nextId && nextId !== priorSession.user.id) {
        return {
          ok: false,
          reason: 'already_linked',
          sessionReady: true,
          providerRefreshToken: exchanged.data.session?.provider_refresh_token ?? refreshToken,
        };
      }
      refreshToken = exchanged.data.session?.provider_refresh_token ?? refreshToken;
    } else if (credential.idToken) {
      const linked = await supabase.auth.linkIdentity({
        provider: credential.provider,
        token: credential.idToken,
        nonce: credential.rawNonce ?? undefined,
      });
      if (linked.error) {
        if (isAlreadyLinkedError(linked.error)) {
          return { ok: false, reason: 'already_linked', sessionReady: false };
        }
        return { ok: false, reason: 'failed', message: failedMessage };
      }
    } else {
      return { ok: false, reason: 'failed', message: failedMessage };
    }

    setAccountLinked(true);
    if (credential.provider === 'apple') {
      const body = credential.authorizationCode
        ? { authorizationCode: credential.authorizationCode }
        : refreshToken
          ? { refresh_token: refreshToken }
          : null;
      const stored = body ? await storeAppleToken(body) : false;
      setAppleTokenMissing(!stored);
    }

    const claim = await claimDevice();
    if (claim?.has_handle) {
      setHandleSaved(true);
      finishHandlePrompt();
      return { ok: true, needsHandle: false };
    }
    requireHandleNow();
    return { ok: true, needsHandle: true };
  } catch (error) {
    if (isAlreadyLinkedError(error)) {
      return { ok: false, reason: 'already_linked', sessionReady: false };
    }
    return { ok: false, reason: 'failed', message: failedMessage };
  } finally {
    if (authTransition() === 'linking') {
      setAuthTransition('idle');
    }
  }
}
