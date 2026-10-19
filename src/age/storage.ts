import * as SecureStore from 'expo-secure-store';

import { isPlayableStatus, type AgeRecord, type AgeSource, type AgeStatus } from './ageStatus';

const ageRecordKey = 'boop.ageRecord';
const termsKey = 'boop.termsAccepted';
const pendingKey = 'boop.pendingConsentRecords';
const deletionKey = 'boop.pendingDeletion';

export type StoredAgeRecord = AgeRecord & { confirmed: boolean };

export type TermsAcceptance = {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: number;
};

export type ConsentEventType = 'age_determined' | 'age_status_changed' | 'terms_accepted';

export type PendingConsentRecord = {
  clientEventId: string;
  eventType: ConsentEventType;
  ageStatus: 'teen' | 'adult' | 'atLeast13';
  ageSource: AgeSource;
  termsVersion: string;
  privacyVersion: string;
  occurredAt: string;
  platform: string;
  appVersion: string;
  userId?: string;
};

const statuses: AgeStatus[] = ['under13', 'teen', 'adult', 'atLeast13', 'unknown'];
const sources: AgeSource[] = ['apple', 'google', 'attestation'];

function isAgeRecord(value: unknown): value is StoredAgeRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as StoredAgeRecord;
  return (
    statuses.includes(record.status) &&
    sources.includes(record.source) &&
    typeof record.updatedAt === 'number' &&
    typeof record.confirmed === 'boolean'
  );
}

function isTerms(value: unknown): value is TermsAcceptance {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const terms = value as TermsAcceptance;
  return (
    typeof terms.termsVersion === 'string' &&
    typeof terms.privacyVersion === 'string' &&
    typeof terms.acceptedAt === 'number'
  );
}

function isPending(value: unknown): value is PendingConsentRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as PendingConsentRecord;
  return (
    typeof record.clientEventId === 'string' &&
    (record.eventType === 'age_determined' ||
      record.eventType === 'age_status_changed' ||
      record.eventType === 'terms_accepted') &&
    isPlayableStatus(record.ageStatus) &&
    sources.includes(record.ageSource) &&
    typeof record.termsVersion === 'string' &&
    typeof record.privacyVersion === 'string' &&
    typeof record.occurredAt === 'string' &&
    typeof record.platform === 'string' &&
    typeof record.appVersion === 'string' &&
    (record.userId == null || typeof record.userId === 'string')
  );
}

async function readJson<T>(key: string, parse: (value: unknown) => T | null): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (raw == null) {
      return null;
    }
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {
    // A failed write leaves the previous record in place.
  }
}

export async function loadAgeRecord(): Promise<StoredAgeRecord | null> {
  return readJson(ageRecordKey, (value) => (isAgeRecord(value) ? value : null));
}

export async function saveAgeRecord(record: StoredAgeRecord): Promise<void> {
  await writeJson(ageRecordKey, record);
}

export async function loadTermsAcceptance(): Promise<TermsAcceptance | null> {
  return readJson(termsKey, (value) => (isTerms(value) ? value : null));
}

export async function saveTermsAcceptance(terms: TermsAcceptance): Promise<void> {
  await writeJson(termsKey, terms);
}

export async function loadPendingConsentRecords(): Promise<PendingConsentRecord[]> {
  const records = await readJson(pendingKey, (value) => (Array.isArray(value) ? value.filter(isPending) : null));
  return records ?? [];
}

export async function savePendingConsentRecords(records: PendingConsentRecord[]): Promise<void> {
  await writeJson(pendingKey, records);
}

export async function loadPendingDeletion(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(deletionKey)) === '1';
  } catch {
    return false;
  }
}

export async function setPendingDeletion(pending: boolean): Promise<void> {
  try {
    if (pending) {
      await SecureStore.setItemAsync(deletionKey, '1');
    } else {
      await SecureStore.deleteItemAsync(deletionKey);
    }
  } catch {
    // Retried on the next launch.
  }
}

export async function clearAgeGateStorage(): Promise<void> {
  await Promise.all(
    [ageRecordKey, termsKey, pendingKey, deletionKey].map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Already absent.
      }
    }),
  );
}
