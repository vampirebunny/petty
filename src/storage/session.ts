import AsyncStorage from '@react-native-async-storage/async-storage';

const attestationKey = 'petty.attestation';
const draftKey = 'petty.draft';
const remindersKey = 'petty.reminders';

export type Attestation = 'passed' | 'blocked';

export type AdoptionDraft = {
  seed: number;
  breedId: string;
};

function isDraft(value: unknown): value is AdoptionDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const draft = value as AdoptionDraft;
  return typeof draft.seed === 'number' && typeof draft.breedId === 'string';
}

export async function loadAttestation(): Promise<Attestation | null> {
  const raw = await AsyncStorage.getItem(attestationKey);
  return raw === 'passed' || raw === 'blocked' ? raw : null;
}

export async function saveAttestation(value: Attestation): Promise<void> {
  await AsyncStorage.setItem(attestationKey, value);
}

export async function clearAttestation(): Promise<void> {
  await AsyncStorage.removeItem(attestationKey);
}

export async function loadDraft(): Promise<AdoptionDraft | null> {
  const raw = await AsyncStorage.getItem(draftKey);
  if (raw == null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: AdoptionDraft): Promise<void> {
  await AsyncStorage.setItem(draftKey, JSON.stringify(draft));
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(draftKey);
}

export async function loadRemindersEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(remindersKey);
  return raw !== 'off';
}

export async function saveRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(remindersKey, enabled ? 'on' : 'off');
}
