import * as SecureStore from 'expo-secure-store';

import { getSupabase } from './supabase';

const installIdKey = 'boop.installId';

let cachedInstallId: string | null = null;
let cachedUserId: string | null = null;

type SessionHook = (userId: string) => Promise<void>;

let beforeSessionPublish: SessionHook | null = null;

export function setBeforeSessionPublish(hook: SessionHook | null): void {
  beforeSessionPublish = hook;
}

export function createUuid(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getCachedInstallId(): string | null {
  return cachedInstallId;
}

export function getCachedUserId(): string | null {
  return cachedUserId;
}

export function setCachedUserId(userId: string | null): void {
  cachedUserId = userId;
}

/** Owner id for stamping: auth uid when known, otherwise the local install id. */
export function getCachedOwnerId(): string | null {
  if (cachedUserId) {
    return cachedUserId;
  }
  return cachedInstallId;
}

export async function getOrCreateInstallId(): Promise<string> {
  if (cachedInstallId) {
    return cachedInstallId;
  }
  try {
    const existing = await SecureStore.getItemAsync(installIdKey);
    if (existing && isUuid(existing)) {
      cachedInstallId = existing;
      return existing;
    }
  } catch {
    // Fall through and create a fresh id.
  }
  const created = createUuid();
  cachedInstallId = created;
  try {
    await SecureStore.setItemAsync(installIdKey, created);
  } catch {
    // Memory still holds the id for this session.
  }
  return created;
}

/** Current session user id only — does not sign in and does not publish the id. */
export async function peekSessionUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  try {
    const existing = await supabase.auth.getSession();
    return existing.data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Current session user id only — does not sign in. */
export async function getSessionUserId(): Promise<string | null> {
  const userId = await peekSessionUserId();
  cachedUserId = userId;
  return userId;
}

/** Sign in anonymously when needed so consent can sync. */
export async function ensureAnonymousUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  try {
    const existing = await supabase.auth.getSession();
    const already = existing.data.session?.user.id ?? null;
    if (already == null) {
      const { readAccountLinked } = await import('../db/accountMeta');
      if (readAccountLinked()) {
        return null;
      }
    }
    if (already) {
      if (beforeSessionPublish) {
        await beforeSessionPublish(already);
      }
      cachedUserId = already;
      return already;
    }
    const signedIn = await supabase.auth.signInAnonymously();
    if (signedIn.error || !signedIn.data.user) {
      return null;
    }
    const userId = signedIn.data.user.id;
    if (beforeSessionPublish) {
      await beforeSessionPublish(userId);
    }
    cachedUserId = userId;
    return userId;
  } catch {
    return null;
  }
}

/**
 * Owner id for local pet stamping. Uses an existing session when present;
 * never forces anonymous sign-in (offline-safe).
 */
export async function resolveOwnerId(): Promise<string> {
  const userId = await getSessionUserId();
  if (userId) {
    return userId;
  }
  return getOrCreateInstallId();
}

/** Test helper: clear in-memory caches between tests. */
export function resetIdentityCache(): void {
  cachedInstallId = null;
  cachedUserId = null;
}
