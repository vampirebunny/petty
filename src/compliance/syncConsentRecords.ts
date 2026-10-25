import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isPlayableStatus, type AgeRecord } from '../age/ageStatus';
import {
  loadAgeRecord,
  loadPendingConsentRecords,
  loadPendingDeletion,
  loadTermsAcceptance,
  savePendingConsentRecords,
  type PendingConsentRecord,
} from '../age/storage';
import { PRIVACY_VERSION, TERMS_VERSION } from '../config/legal';
import { ensureAnonymousUserId } from './identity';
import { getSupabase } from './supabase';

function clientEventId(): string {
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

function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function platformName(): string {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }
  return 'web';
}

function eventFor(
  record: AgeRecord,
  eventType: PendingConsentRecord['eventType'],
  occurredAt: string,
): PendingConsentRecord | null {
  if (!isPlayableStatus(record.status)) {
    return null;
  }
  return {
    clientEventId: clientEventId(),
    eventType,
    ageStatus: record.status,
    ageSource: record.source,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    occurredAt,
    platform: platformName(),
    appVersion: appVersion(),
  };
}

export async function enqueueConsentEvents(events: PendingConsentRecord[]): Promise<void> {
  if (events.length === 0) {
    return;
  }
  const pending = await loadPendingConsentRecords();
  await savePendingConsentRecords([...pending, ...events]);
}

export async function enqueueAgeDetermination(record: AgeRecord, occurredAt: string): Promise<void> {
  const event = eventFor(record, 'age_determined', occurredAt);
  if (event) {
    await enqueueConsentEvents([event]);
  }
}

export async function enqueueTermsAccepted(record: AgeRecord, occurredAt: string): Promise<void> {
  const event = eventFor(record, 'terms_accepted', occurredAt);
  if (event) {
    await enqueueConsentEvents([event]);
  }
}

export async function enqueueAgeStatusChanged(record: AgeRecord, occurredAt: string): Promise<void> {
  const event = eventFor(record, 'age_status_changed', occurredAt);
  if (event) {
    await enqueueConsentEvents([event]);
  }
}

/** Upload this device's attestation onto the signed-in account when that account has no copy yet. */
export async function syncLocalConsentToSession(parts: { age: boolean; terms: boolean }): Promise<void> {
  if (!parts.age && !parts.terms) {
    return;
  }
  const stored = await loadAgeRecord();
  if (!stored?.confirmed || !isPlayableStatus(stored.status)) {
    return;
  }
  const terms = await loadTermsAcceptance();
  const termsCurrent = terms?.termsVersion === TERMS_VERSION && terms.privacyVersion === PRIVACY_VERSION;
  const events: PendingConsentRecord[] = [];
  if (parts.age) {
    const ageEvent = eventFor(stored, 'age_determined', new Date(stored.updatedAt).toISOString());
    if (ageEvent) {
      events.push(ageEvent);
    }
  }
  if (parts.terms && termsCurrent && terms) {
    const termsEvent = eventFor(stored, 'terms_accepted', new Date(terms.acceptedAt).toISOString());
    if (termsEvent) {
      events.push(termsEvent);
    }
  }
  if (events.length === 0) {
    return;
  }
  const supabase = getSupabase();
  const userId = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!supabase || !userId) {
    return;
  }
  await supabase.from('consent_records').upsert(
    events.map((record) => ({
      user_id: userId,
      event_type: record.eventType,
      age_status: record.ageStatus,
      age_source: record.ageSource,
      terms_version: record.termsVersion,
      privacy_version: record.privacyVersion,
      occurred_at: record.occurredAt,
      platform: record.platform,
      app_version: record.appVersion,
      client_event_id: record.clientEventId,
    })),
    { onConflict: 'client_event_id', ignoreDuplicates: true },
  );
}

export async function flushConsentRecords(): Promise<void> {
  try {
    const pending = await loadPendingConsentRecords();
    if (pending.length === 0) {
      return;
    }
    const userId = pending.every((record) => record.userId)
      ? pending[0].userId ?? null
      : await ensureAnonymousUserId();
    if (!userId) {
      return;
    }
    const stamped = pending.map((record) => ({ ...record, userId }));
    await savePendingConsentRecords(stamped);
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from('consent_records').upsert(
      stamped.map((record) => ({
        user_id: record.userId,
        event_type: record.eventType,
        age_status: record.ageStatus,
        age_source: record.ageSource,
        terms_version: record.termsVersion,
        privacy_version: record.privacyVersion,
        occurred_at: record.occurredAt,
        platform: record.platform,
        app_version: record.appVersion,
        client_event_id: record.clientEventId,
      })),
      { onConflict: 'client_event_id', ignoreDuplicates: true },
    );
    if (error || (await loadPendingDeletion())) {
      return;
    }
    const sent = new Set(stamped.map((record) => record.clientEventId));
    const latest = await loadPendingConsentRecords();
    await savePendingConsentRecords(latest.filter((record) => !sent.has(record.clientEventId)));
  } catch {
    // Leave the queue for the next launch, foreground, or connection.
  }
}

export async function deleteGuestAccount(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return false;
    }
    const existing = await supabase.auth.getSession();
    if (!existing.data.session) {
      return true;
    }
    const { error } = await supabase.rpc('delete_my_guest_data');
    if (error) {
      return false;
    }
    await supabase.auth.signOut();
    return true;
  } catch {
    return false;
  }
}

export async function signOutLocally(): Promise<void> {
  try {
    await getSupabase()?.auth.signOut();
  } catch {
    // The local session is cleared on the next successful sign-out.
  }
}
