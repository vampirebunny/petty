import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { statusFromBounds, type AgeRecord, type AgeSource } from './ageStatus';

const signalTimeoutMs = 3000;

export type DevAgeSignal = 'live' | 'adult' | 'teen' | 'under13' | 'unknown';

type NativeBounds = { lower?: number; upper?: number } | null;

type NativeAgeSignals = {
  fetchBounds(): Promise<NativeBounds>;
};

let devSignal: DevAgeSignal = 'live';

export function setDevAgeSignal(next: DevAgeSignal): void {
  if (__DEV__) {
    devSignal = next;
  }
}

export function currentDevAgeSignal(): DevAgeSignal {
  return devSignal;
}

function storeSource(): AgeSource {
  return Platform.OS === 'android' ? 'google' : 'apple';
}

function recordFromBounds(bounds: NativeBounds, source: AgeSource): AgeRecord | null {
  const lower = typeof bounds?.lower === 'number' ? bounds.lower : null;
  const upper = typeof bounds?.upper === 'number' ? bounds.upper : null;
  const status = statusFromBounds(lower, upper);
  if (!status) {
    return null;
  }
  return { status, source, updatedAt: Date.now() };
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function readNativeBounds(): Promise<NativeBounds> {
  try {
    const native = requireOptionalNativeModule<NativeAgeSignals>('AgeSignals');
    if (!native) {
      return null;
    }
    return await native.fetchBounds();
  } catch {
    return null;
  }
}

export async function fetchStoreAgeSignal(): Promise<AgeRecord | null> {
  if (__DEV__ && devSignal !== 'live') {
    if (devSignal === 'unknown') {
      return null;
    }
    return { status: devSignal, source: storeSource(), updatedAt: Date.now() };
  }
  const bounds = await withTimeout(readNativeBounds(), signalTimeoutMs);
  if (!bounds) {
    return null;
  }
  return recordFromBounds(bounds, storeSource());
}
