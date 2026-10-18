import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Look } from '../sim/types';

const attestationKey = 'petty.attestation';
const draftKey = 'petty.draft';
const remindersKey = 'petty.reminders';
const soundKey = 'petty.sound';

export type Attestation = 'passed' | 'blocked';

export type AdoptionStep = 'species' | 'breed' | 'look' | 'offers';

const adoptionSteps: AdoptionStep[] = ['species', 'breed', 'look', 'offers'];

// What the adoption flow remembers before a pet is saved. The seed is written the moment it is
// created, so backing out and returning shows the same three attribute sets.
export type AdoptionDraft = {
  seed: number;
  species: 'dog' | 'cat';
  breedId: string | null;
  look: Look | null;
  step: AdoptionStep;
};

function isLook(value: unknown): value is Look {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const look = value as Look;
  return typeof look.coat === 'string' && typeof look.ear === 'string' && typeof look.tail === 'string';
}

function isDraft(value: unknown): value is AdoptionDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const draft = value as AdoptionDraft;
  return (
    typeof draft.seed === 'number' &&
    Number.isFinite(draft.seed) &&
    (draft.species === 'dog' || draft.species === 'cat') &&
    (draft.breedId === null || typeof draft.breedId === 'string') &&
    (draft.look === null || isLook(draft.look)) &&
    adoptionSteps.includes(draft.step)
  );
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

export async function loadSoundEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(soundKey);
  return raw !== 'off';
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(soundKey, enabled ? 'on' : 'off');
}
