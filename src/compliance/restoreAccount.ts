import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import { saveAgeRecord, saveTermsAcceptance, type StoredAgeRecord } from '../age/storage';
import { isPlayableStatus, type AgeSource, type AgeStatus } from '../age/ageStatus';
import { syncLocalConsentToSession } from './syncConsentRecords';
import { requestAgeGateRefresh } from '../state/ageGateRefresh';
import {
  readRestoreInProgress,
  setAccountLinked,
  setAppleTokenMissing,
  setHandleSaved,
  setRestoreInProgress,
  type RestoreProgress,
} from '../db/accountMeta';
import { applyRestore, type RestoredLedgerEntry, type RestoredPet } from '../db/applyRestore';
import { ownerIdTables } from '../db/ownerTables';
import { getDb } from '../db/database';
import type { PlayerDoc } from '../db/playerHome';
import type { LedgerLine } from '../db/ledgerWrite';
import type { PetState } from '../sim/types';
import { prepareInstalledPet, setAuthTransition, authTransition, welcomeIsHeld } from '../state/sessionGate';
import { claimDevice } from '../sync/activeDevice';
import { pingAuthHealth } from './authHealth';
import { requireHandleNow } from './handlePrompt';
import { setCachedUserId } from './identity';
import { storeAppleToken } from './linkAccount';
import { getSupabase } from './supabase';
import type { AuthCredential } from './appleCredential';

const guestSessionKey = 'boop.guestSession';
const pendingSupersedeKey = 'boop.pendingSupersede';
const failedMessage = "We couldn't sign you in. Try again.";

type GuestSession = { access_token: string; refresh_token: string };

export type RestoreStart = {
  credential: AuthCredential | null;
  guestAccessToken: string | null;
  guestRefreshToken: string | null;
  guestUserId: string | null;
  sessionReady: boolean;
  providerRefreshToken?: string;
  /** False installs the signed-in anonymous user's pet and does not mark the device linked. */
  linkAccount?: boolean;
};

export function hasGuestProgress(): boolean {
  const database = getDb();
  if (database.getFirstSync('SELECT id FROM pet LIMIT 1')) {
    return true;
  }
  for (const table of ownerIdTables) {
    if (database.getFirstSync(`SELECT 1 AS ok FROM ${table} LIMIT 1`)) {
      return true;
    }
  }
  return Boolean(database.getFirstSync('SELECT 1 AS ok FROM daily_counters LIMIT 1'));
}

export function confirmReplaceGuest(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'You already have an account',
      'Signing in will bring back your pet from that account and remove the guest pet on this device.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign in', onPress: () => resolve(true) },
      ],
    );
  });
}

async function readGuestSession(): Promise<GuestSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(guestSessionKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as GuestSession;
    if (!parsed.access_token || !parsed.refresh_token) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveGuestKeys(access: string, refresh: string, guestUserId: string): Promise<void> {
  await SecureStore.setItemAsync(guestSessionKey, JSON.stringify({ access_token: access, refresh_token: refresh }));
  await SecureStore.setItemAsync(pendingSupersedeKey, access);
  const progress: RestoreProgress = { startedAt: Date.now(), guestUserId };
  setRestoreInProgress(progress);
}

async function clearGuestKeys(): Promise<void> {
  setRestoreInProgress(null);
  await SecureStore.deleteItemAsync(guestSessionKey).catch(() => undefined);
  await SecureStore.deleteItemAsync(pendingSupersedeKey).catch(() => undefined);
}

async function clearGuestSessionOnly(): Promise<void> {
  await SecureStore.deleteItemAsync(guestSessionKey).catch(() => undefined);
}

export async function guestSessionRestores(): Promise<boolean> {
  const guest = await readGuestSession();
  const supabase = getSupabase();
  if (!guest || !supabase) {
    return false;
  }
  const restored = await supabase.auth.setSession(guest);
  return !restored.error;
}

async function rollbackToGuest(): Promise<void> {
  const guest = await readGuestSession();
  const supabase = getSupabase();
  if (guest && supabase) {
    await supabase.auth.setSession(guest);
  }
  await clearGuestKeys();
}

function asLines(value: unknown): LedgerLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((line) => {
    if (!line || typeof line !== 'object' || typeof (line as { asset?: unknown }).asset !== 'string') {
      return [];
    }
    const row = line as {
      asset: string;
      qty?: number;
      delta?: number;
      unit_price?: number | null;
      deal?: boolean;
      serial?: number | null;
      toy_id?: string | null;
      furniture_id?: string | null;
      scene?: string | null;
    };
    const delta = typeof row.qty === 'number' ? row.qty : typeof row.delta === 'number' ? row.delta : 0;
    return [
      {
        asset: row.asset,
        delta,
        unitPrice: row.unit_price ?? null,
        deal: Boolean(row.deal),
        serial: row.serial ?? null,
        toyId: row.toy_id ?? null,
        furnitureId: row.furniture_id ?? null,
        scene: row.scene ?? null,
      },
    ];
  });
}

async function signIntoAccount(
  credential: AuthCredential,
): Promise<{ ok: true; userId: string; refreshToken?: string } | { ok: false; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: failedMessage };
  }
  if (credential.provider === 'apple' && credential.pkceCode) {
    const exchanged = await supabase.auth.exchangeCodeForSession(credential.pkceCode);
    if (exchanged.error || !exchanged.data.user) {
      return { ok: false, message: exchanged.error?.message || failedMessage };
    }
    return {
      ok: true,
      userId: exchanged.data.user.id,
      refreshToken: exchanged.data.session?.provider_refresh_token ?? undefined,
    };
  }
  if (!credential.idToken) {
    return { ok: false, message: failedMessage };
  }
  const signed = await supabase.auth.signInWithIdToken({
    provider: credential.provider,
    token: credential.idToken,
    nonce: credential.rawNonce ?? undefined,
  });
  if (signed.error || !signed.data.user) {
    return { ok: false, message: signed.error?.message || failedMessage };
  }
  return { ok: true, userId: signed.data.user.id };
}

async function copyConsent(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }
  const { data, error } = await supabase
    .from('consent_records')
    .select('event_type, age_status, age_source, terms_version, privacy_version, occurred_at')
    .order('occurred_at', { ascending: true });
  if (error || !data) {
    return;
  }
  let age: StoredAgeRecord | null = null;
  let terms: { termsVersion: string; privacyVersion: string; acceptedAt: number } | null = null;
  for (const row of data) {
    if (row.event_type === 'age_determined' || row.event_type === 'age_status_changed') {
      const status = row.age_status as AgeStatus | null;
      const source = row.age_source as AgeSource | null;
      if (status && isPlayableStatus(status) && source) {
        age = {
          status,
          source,
          updatedAt: Date.parse(row.occurred_at),
          confirmed: true,
        };
      }
    }
    if (row.event_type === 'terms_accepted' && row.terms_version && row.privacy_version) {
      terms = {
        termsVersion: row.terms_version,
        privacyVersion: row.privacy_version,
        acceptedAt: Date.parse(row.occurred_at),
      };
    }
  }
  if (age) {
    await saveAgeRecord(age);
  }
  if (terms) {
    await saveTermsAcceptance(terms);
  }
  // An account with no pet often has no consent row yet. Keep the attestation from this
  // device and copy it onto the account so adoption can continue.
  if (!age || !terms) {
    await syncLocalConsentToSession({ age: !age, terms: !terms }).catch(() => undefined);
  }
  requestAgeGateRefresh();
}

/** True when there is no pending guest, or that guest was deleted. False leaves the token in place. */
export async function supersedePendingGuest(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(pendingSupersedeKey).catch(() => null);
  const supabase = getSupabase();
  if (!token) {
    return true;
  }
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase.functions.invoke('supersede_guest', {
    body: { guest_access_token: token },
  });
  const ok = data && typeof data === 'object' && 'ok' in data && data.ok === true;
  if (!error && ok) {
    await SecureStore.deleteItemAsync(pendingSupersedeKey).catch(() => undefined);
    return true;
  }
  return false;
}

export async function beginRestore(
  start: RestoreStart & { skipConfirm?: boolean },
): Promise<{ ok: true } | { ok: false; message: string } | { ok: false; cancelled: true }> {
  if (authTransition() !== 'idle') {
    return { ok: false, message: failedMessage };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: failedMessage };
  }
  if (!start.skipConfirm && hasGuestProgress()) {
    const proceed = await confirmReplaceGuest();
    if (!proceed) {
      if (start.sessionReady && start.guestAccessToken && start.guestRefreshToken) {
        await supabase.auth.setSession({
          access_token: start.guestAccessToken,
          refresh_token: start.guestRefreshToken,
        });
      }
      return { ok: false, cancelled: true };
    }
  }
  setAuthTransition('restoring');
  let signedIn = start.sessionReady;
  let signedUserId: string | null = null;
  let committed = false;
  try {
    if (!start.sessionReady && start.credential) {
      if (start.guestAccessToken && start.guestRefreshToken && start.guestUserId) {
        await saveGuestKeys(start.guestAccessToken, start.guestRefreshToken, start.guestUserId);
      }
      const signed = await signIntoAccount(start.credential);
      if (!signed.ok) {
        await clearGuestKeys();
        return { ok: false, message: signed.message };
      }
      signedIn = true;
      signedUserId = signed.userId;
      const refresh = signed.refreshToken ?? start.providerRefreshToken;
      await rememberApple(start.credential, refresh);
    } else if (start.sessionReady) {
      if (start.guestAccessToken && start.guestRefreshToken && start.guestUserId) {
        await saveGuestKeys(start.guestAccessToken, start.guestRefreshToken, start.guestUserId);
      }
      if (start.credential) {
        await rememberApple(start.credential, start.providerRefreshToken);
      }
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? signedUserId;
    if (!userId) {
      if (signedIn) {
        await rollbackToGuest();
      }
      return { ok: false, message: userError?.message || failedMessage };
    }
    setCachedUserId(userId);

    const claim = await claimDevice();
    if (!claim) {
      await rollbackToGuest();
      return { ok: false, message: failedMessage };
    }
    const { data, error } = await supabase.rpc('pull_account_state');
    if (error || !data || typeof data !== 'object') {
      await rollbackToGuest();
      return { ok: false, message: error?.message || failedMessage };
    }
    const pulled = data as {
      pet?: PetState | null;
      player?: PlayerDoc | null;
      server_now?: string;
      server_revision?: number;
    };
    const { data: retiredRows } = await supabase
      .from('pets')
      .select('id, doc, retired_at')
      .eq('status', 'retired');
    const { data: ledgerRows } = await supabase
      .from('ledger_entries')
      .select('idempotency_key, source, lines')
      .order('server_time', { ascending: true });
    const retired: RestoredPet[] = (retiredRows ?? []).flatMap((row) => {
      if (!row.doc || typeof row.doc !== 'object') {
        return [];
      }
      return [
        {
          id: row.id,
          doc: row.doc as PetState,
          retiredAt: row.retired_at ? Date.parse(row.retired_at) : Date.now(),
        },
      ];
    });
    const ledger: RestoredLedgerEntry[] = (ledgerRows ?? []).map((row) => ({
      key: row.idempotency_key,
      source: row.source,
      lines: asLines(row.lines),
    }));
    const serverNowMs = Date.parse(pulled.server_now ?? claim.server_now);
    await applyRestore({
      userId,
      pet: pulled.pet?.id ? pulled.pet : null,
      retired,
      player: pulled.player ?? null,
      ledger,
      serverRevision: pulled.server_revision ?? claim.server_revision,
      hasHandle: claim.has_handle,
      serverNowMs: Number.isFinite(serverNowMs) ? serverNowMs : Date.now(),
      linkAccount: start.linkAccount !== false,
    });
    committed = true;
    await clearGuestSessionOnly();
    if (start.linkAccount !== false) {
      await copyConsent();
      if (!claim.has_handle) {
        requireHandleNow();
      }
    }
    await prepareInstalledPet();
  } catch (error) {
    if (!committed) {
      if (signedIn) {
        await rollbackToGuest();
      } else {
        await clearGuestKeys();
      }
    }
    const message = error instanceof Error ? error.message.trim() : '';
    return { ok: false, message: message || failedMessage };
  } finally {
    if (authTransition() === 'restoring') {
      setAuthTransition('idle');
    }
  }
  await supersedePendingGuest();
  return { ok: true };
}

async function rememberApple(credential: AuthCredential, refreshToken?: string): Promise<void> {
  if (credential.provider !== 'apple') {
    return;
  }
  const body = credential.authorizationCode
    ? { authorizationCode: credential.authorizationCode }
    : refreshToken
      ? { refresh_token: refreshToken }
      : null;
  setAppleTokenMissing(body ? !(await storeAppleToken(body)) : true);
}

export async function resumeRestore(): Promise<
  { ok: true } | { ok: false; message: string } | { ok: false; cancelled: true }
> {
  const progress = readRestoreInProgress();
  if (!progress) {
    return { ok: false, message: failedMessage };
  }
  return beginRestore({
    credential: null,
    guestAccessToken: null,
    guestRefreshToken: null,
    guestUserId: progress.guestUserId,
    sessionReady: true,
    skipConfirm: true,
  });
}

export async function cancelRestore(): Promise<'restored' | 'lost'> {
  const ok = await guestSessionRestores();
  await clearGuestKeys();
  return ok ? 'restored' : 'lost';
}

export async function clearLeftoverGuestSession(): Promise<void> {
  if (readRestoreInProgress()) {
    return;
  }
  await SecureStore.deleteItemAsync(guestSessionKey).catch(() => undefined);
}

export type InstallResult = 'home' | 'adopt' | 'welcome' | 'offline' | 'restore';

type PendingInstall =
  | { kind: 'restore'; linkAccount: boolean; hasPet: boolean }
  | { kind: 'linked-adopt'; hasHandle: boolean };

// Decided during the splash check. Applied only after Get started, so a reinstall shows Welcome first.
let pendingInstall: PendingInstall | null = null;

export function hasPendingInstall(): boolean {
  return pendingInstall != null;
}

export function clearPendingInstall(): void {
  pendingInstall = null;
}

function userIsGone(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }
  const code = error.code ?? '';
  if (code === 'user_not_found' || code === 'user_banned') {
    return true;
  }
  const message = error.message ?? '';
  return /user.*(not found|does not exist)/i.test(message) || /sub claim/i.test(message);
}

// A Keychain session with an empty database. No confirm, no guest delete, and no local write.
export async function installServerPet(): Promise<InstallResult> {
  pendingInstall = null;
  if (welcomeIsHeld()) {
    return 'welcome';
  }
  if (getDb().getFirstSync('SELECT id FROM pet LIMIT 1')) {
    return 'home';
  }
  const supabase = getSupabase();
  if (!supabase) {
    return 'welcome';
  }
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser) {
    return 'welcome';
  }
  if (!(await pingAuthHealth())) {
    return 'offline';
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    if (userIsGone(userError)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return 'welcome';
    }
    return 'offline';
  }
  const user = userData.user;
  const pulled = await supabase.rpc('pull_account_state');
  if (pulled.error || !pulled.data || typeof pulled.data !== 'object') {
    return 'offline';
  }
  const body = pulled.data as { pet?: { id?: string } | null; has_handle?: boolean };
  const hasPet = Boolean(body.pet && typeof body.pet === 'object' && body.pet.id);
  const retired = await supabase.from('pets').select('id').eq('status', 'retired').limit(1);
  if (retired.error) {
    return 'offline';
  }
  const hasRetired = (retired.data ?? []).length > 0;
  const linked = user.is_anonymous !== true;
  if (!hasPet && !hasRetired) {
    if (!linked) {
      return 'welcome';
    }
    pendingInstall = { kind: 'linked-adopt', hasHandle: Boolean(body.has_handle) };
    return 'adopt';
  }
  pendingInstall = { kind: 'restore', linkAccount: linked, hasPet };
  return 'restore';
}

// Writes the account found by installServerPet. Welcome calls this from Get started.
export async function commitPendingInstall(): Promise<InstallResult> {
  const pending = pendingInstall;
  pendingInstall = null;
  if (!pending) {
    return 'welcome';
  }
  if (pending.kind === 'linked-adopt') {
    setAccountLinked(true);
    setHandleSaved(pending.hasHandle);
    await copyConsent();
    if (!pending.hasHandle) {
      requireHandleNow();
    }
    return 'adopt';
  }
  const restored = await beginRestore({
    credential: null,
    guestAccessToken: null,
    guestRefreshToken: null,
    guestUserId: null,
    sessionReady: true,
    skipConfirm: true,
    linkAccount: pending.linkAccount,
  });
  if (!restored.ok) {
    pendingInstall = pending;
    return 'offline';
  }
  return pending.hasPet ? 'home' : 'adopt';
}

export async function accountSessionIsCurrent(): Promise<boolean> {
  const supabase = getSupabase();
  const progress = readRestoreInProgress();
  if (!supabase || !progress) {
    return false;
  }
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user && !data.user.is_anonymous && data.user.id !== progress.guestUserId);
}
