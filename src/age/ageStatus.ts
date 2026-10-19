export type AgeStatus = 'under13' | 'teen' | 'adult' | 'atLeast13' | 'unknown';

export type AgeSource = 'apple' | 'google' | 'attestation';

export type PlayableAgeStatus = 'teen' | 'adult' | 'atLeast13';

export interface AgeRecord {
  status: AgeStatus;
  source: AgeSource;
  updatedAt: number;
}

// Higher wins. A later signal can move a user younger, never older.
const restrictiveness: Record<AgeStatus, number> = {
  under13: 4,
  teen: 3,
  atLeast13: 2,
  adult: 1,
  unknown: 0,
};

export function mergeAgeRecords(existing: AgeRecord | null, incoming: AgeRecord | null): AgeRecord | null {
  if (!incoming || incoming.status === 'unknown') {
    return existing;
  }
  if (!existing || existing.status === 'unknown') {
    return incoming;
  }
  if (restrictiveness[incoming.status] > restrictiveness[existing.status]) {
    return incoming;
  }
  return existing;
}

export function canPlay(record: AgeRecord | null): boolean {
  return isPlayableStatus(record?.status);
}

export function canPurchase(record: AgeRecord | null): boolean {
  return record?.status === 'adult' && (record.source === 'apple' || record.source === 'google');
}

export function isPlayableStatus(status: AgeStatus | undefined): status is PlayableAgeStatus {
  return status === 'teen' || status === 'adult' || status === 'atLeast13';
}

// A Yes confirms the store band when one exists. It becomes an attestation only when the store gave no answer.
export function confirmYes(existing: AgeRecord | null, now: number): AgeRecord {
  if (existing && existing.status !== 'unknown') {
    return { ...existing, updatedAt: now };
  }
  return { status: 'atLeast13', source: 'attestation', updatedAt: now };
}

export function confirmNo(now: number): AgeRecord {
  return { status: 'under13', source: 'attestation', updatedAt: now };
}

// Apple uses nil for an open end. Google uses null ageUpper for 18+.
export function statusFromBounds(lower: number | null, upper: number | null): PlayableAgeStatus | 'under13' | null {
  if (upper != null && upper < 13) {
    return 'under13';
  }
  if (lower == null && upper == null) {
    return null;
  }
  if (lower == null) {
    return 'under13';
  }
  if (lower >= 18 || upper == null) {
    return 'adult';
  }
  if (lower >= 13) {
    return 'teen';
  }
  return 'under13';
}
