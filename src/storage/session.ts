import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Look } from '../sim/types';

const attestationKey = 'petty.attestation';
const draftKey = 'petty.draft';
const remindersKey = 'petty.reminders';
const soundKey = 'petty.sound';

export type Attestation = 'passed' | 'blocked';

// Species, look, and breed share one design screen. Offers (choose a pup) and name follow.
export type AdoptionStep = 'design' | 'offers' | 'name';

// Older drafts used separate species / breed / look steps; fold them into design on load.
const legacySteps = ['species', 'breed', 'look'] as const;

// What the adoption flow remembers before a pet is saved. The seed is written the moment it is
// created, so backing out and returning shows the same three attribute sets.
export type AdoptionDraft = {
  seed: number;
  species: 'dog' | 'cat';
  breedId: string | null;
  look: Look | null;
  step: AdoptionStep;
  // The pup picked on the offers step and the name typed so far, kept so Back restores them.
  archetype?: 'athlete' | 'thinker' | 'charmer';
  name?: string;
};

function isLook(value: unknown): value is Look {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const look = value as Look;
  return typeof look.coat === 'string' && typeof look.ear === 'string' && typeof look.tail === 'string';
}

function readDraft(value: unknown): AdoptionDraft | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const draft = value as Record<string, unknown>;
  const rawStep = draft.step;
  const step: AdoptionStep | null =
    rawStep === 'design' || rawStep === 'offers' || rawStep === 'name'
      ? rawStep
      : typeof rawStep === 'string' && (legacySteps as readonly string[]).includes(rawStep)
        ? 'design'
        : null;
  if (
    typeof draft.seed !== 'number' ||
    !Number.isFinite(draft.seed) ||
    (draft.species !== 'dog' && draft.species !== 'cat') ||
    (draft.breedId !== null && typeof draft.breedId !== 'string') ||
    (draft.look !== null && !isLook(draft.look)) ||
    step == null
  ) {
    return null;
  }
  const result: AdoptionDraft = {
    seed: draft.seed,
    species: draft.species,
    breedId: draft.breedId,
    look: draft.look,
    step,
  };
  if (draft.archetype === 'athlete' || draft.archetype === 'thinker' || draft.archetype === 'charmer') {
    result.archetype = draft.archetype;
  }
  if (typeof draft.name === 'string') {
    result.name = draft.name.slice(0, 16);
  }
  return result;
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
    return readDraft(JSON.parse(raw));
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
