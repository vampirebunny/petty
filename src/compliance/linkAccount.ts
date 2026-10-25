import { setAccountLinked, setAppleTokenMissing, setHandleSaved } from '../db/accountMeta';
import { authTransition, setAuthTransition } from '../state/sessionGate';
import { claimDevice } from '../sync/activeDevice';
import type { AuthCredential } from './appleCredential';
import { ensureAnonymousUserId } from './identity';
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
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return /already linked|already been registered/i.test(message) || code === 'identity_already_exists' || code === 'email_exists';
}

function fail(error?: unknown): LinkResult {
  if (isAlreadyLinkedError(error)) {
    return { ok: false, reason: 'already_linked', sessionReady: false };
  }
  const message = error instanceof Error ? error.message.trim() : '';
  return { ok: false, reason: 'failed', message: message || failedMessage };
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
    return fail(new Error("Couldn't start sign-in while the app was busy."));
  }
  const supabase = getSupabase();
  if (!supabase) {
    return fail();
  }
  // Stay idle so a new anonymous session rebinds this pet before linking.
  // linkIdentity needs that session; without it the ID-token grant signs into a different user.
  const guestId = await ensureAnonymousUserId();
  if (!guestId) {
    return fail(new Error("Couldn't start a guest session for this pet."));
  }
  setAuthTransition('linking');
  try {
    let refreshToken = credential.providerRefreshToken;
    if (credential.provider === 'apple' && credential.pkceCode) {
      const { data: prior } = await supabase.auth.getSession();
      const priorSession = prior.session;
      const exchanged = await supabase.auth.exchangeCodeForSession(credential.pkceCode);
      if (exchanged.error) {
        return fail(exchanged.error);
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
      const { data: prior } = await supabase.auth.getSession();
      const priorId = prior.session?.user.id ?? null;
      const linked = await supabase.auth.linkIdentity({
        provider: credential.provider,
        token: credential.idToken,
        nonce: credential.rawNonce ?? undefined,
      });
      if (linked.error) {
        return fail(linked.error);
      }
      const nextId = linked.data.user?.id ?? linked.data.session?.user.id ?? null;
      if (priorId && nextId && nextId !== priorId) {
        return {
          ok: false,
          reason: 'already_linked',
          sessionReady: true,
          providerRefreshToken: linked.data.session?.provider_refresh_token ?? undefined,
        };
      }
      if (!priorId || !nextId || nextId !== priorId) {
        return fail(new Error("This sign-in didn't stay on this pet."));
      }
    } else {
      return fail(new Error('Sign-in did not return a token.'));
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
    return fail(error);
  } finally {
    if (authTransition() === 'linking') {
      setAuthTransition('idle');
    }
  }
}
