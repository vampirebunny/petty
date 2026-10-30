import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { confirmNo, confirmYes, isPlayableStatus, mergeAgeRecords } from '../age/ageStatus';
import { fetchStoreAgeSignal, setDevAgeSignal, type DevAgeSignal } from '../age/ageSignal';
import {
  clearAgeGateStorage,
  loadAgeRecord,
  loadPendingDeletion,
  loadTermsAcceptance,
  saveAgeRecord,
  savePendingConsentRecords,
  saveTermsAcceptance,
  setPendingDeletion,
  type StoredAgeRecord,
  type TermsAcceptance,
} from '../age/storage';
import { PRIVACY_VERSION, TERMS_VERSION } from '../config/legal';
import { onAgeGateRefresh } from './ageGateRefresh';
import { setAgeGatePhase, type AgeGatePhase } from './ageGatePhase';
import { eraseUnder13 } from '../compliance/deleteAccount';
import { enableAfterConsent, track } from '../analytics/analytics';
import {
  enqueueAgeDetermination,
  enqueueAgeStatusChanged,
  enqueueTermsAccepted,
  flushConsentRecords,
  signOutLocally,
} from '../compliance/syncConsentRecords';

export type { AgeGatePhase };

function termsAreCurrent(terms: TermsAcceptance | null): boolean {
  return terms?.termsVersion === TERMS_VERSION && terms.privacyVersion === PRIVACY_VERSION;
}

type Options = {
  onUnavailable: () => void;
  isFirstOnboarding?: () => boolean;
};

export function useAgeGate({ onUnavailable, isFirstOnboarding }: Options) {
  const [phase, setPhase] = useState<AgeGatePhase>('loading');
  const [askAge, setAskAge] = useState(true);
  const onUnavailableRef = useRef(onUnavailable);
  const tail = useRef(Promise.resolve());

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    setAgeGatePhase(phase);
  }, [phase]);

  const enqueueWork = useCallback((task: () => Promise<void>) => {
    const run = tail.current.then(task, task);
    tail.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const finishUnavailable = useCallback((nextAskAge: boolean) => {
    onUnavailableRef.current();
    setAskAge(nextAskAge);
    setPhase('unavailable');
  }, []);

  const downgrade = useCallback(async () => {
    await savePendingConsentRecords([]);
    const erased = await eraseUnder13();
    await setPendingDeletion(!erased);
  }, []);

  const refresh = useCallback(() => {
    return enqueueWork(async () => {
      if (await loadPendingDeletion()) {
        if (await eraseUnder13()) {
          await setPendingDeletion(false);
        }
      }
      const stored = await loadAgeRecord();
      const terms = await loadTermsAcceptance();
      const signal = await fetchStoreAgeSignal();
      const merged = mergeAgeRecords(stored, signal);
      let next: StoredAgeRecord | null = stored;
      if (merged && (merged.status !== stored?.status || merged.source !== stored?.source)) {
        next = { ...merged, confirmed: stored?.confirmed ?? false };
        await saveAgeRecord(next);
      }

      if (next?.confirmed && next.status === 'under13') {
        await downgrade();
        finishUnavailable(false);
        return;
      }

      if (
        next?.confirmed &&
        stored &&
        isPlayableStatus(stored.status) &&
        isPlayableStatus(next.status) &&
        stored.status !== next.status &&
        termsAreCurrent(terms)
      ) {
        await enqueueAgeStatusChanged(next, new Date().toISOString());
      }

      if (next?.confirmed && isPlayableStatus(next.status) && termsAreCurrent(terms)) {
        void flushConsentRecords();
        setAskAge(false);
        setPhase('ready');
        return;
      }

      if (next?.confirmed && isPlayableStatus(next.status)) {
        void flushConsentRecords();
      }
      setAskAge(!next?.confirmed);
      setPhase('consent');
    });
  }, [downgrade, enqueueWork, finishUnavailable]);

  const continueYes = useCallback(() => {
    return enqueueWork(async () => {
      const stored = await loadAgeRecord();
      const now = Date.now();
      const confirmed = { ...confirmYes(stored, now), confirmed: true };
      await saveAgeRecord(confirmed);
      if (confirmed.status === 'under13') {
        await downgrade();
        finishUnavailable(false);
        return;
      }
      const occurredAt = new Date(now).toISOString();
      await saveTermsAcceptance({
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: now,
      });
      await enqueueAgeDetermination(confirmed, occurredAt);
      await enqueueTermsAccepted(confirmed, occurredAt);
      void flushConsentRecords();
      setAskAge(false);
      setPhase('ready');
      enableAfterConsent();
      if (isFirstOnboarding?.()) {
        track('onboarding_step', { step: 'consent_accepted' });
      }
    });
  }, [downgrade, enqueueWork, finishUnavailable, isFirstOnboarding]);

  const continueNo = useCallback(() => {
    return enqueueWork(async () => {
      const confirmed = { ...confirmNo(Date.now()), confirmed: true };
      await saveAgeRecord(confirmed);
      await downgrade();
      finishUnavailable(false);
    });
  }, [downgrade, enqueueWork, finishUnavailable]);

  const acceptUpdatedTerms = useCallback(() => {
    return enqueueWork(async () => {
      const stored = await loadAgeRecord();
      if (!stored?.confirmed || !isPlayableStatus(stored.status)) {
        setAskAge(!stored?.confirmed);
        setPhase('consent');
        return;
      }
      const now = Date.now();
      await saveTermsAcceptance({
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: now,
      });
      await enqueueTermsAccepted(stored, new Date(now).toISOString());
      void flushConsentRecords();
      setAskAge(false);
      setPhase('ready');
    });
  }, [enqueueWork]);

  const clear = useCallback(() => {
    return enqueueWork(async () => {
      setDevAgeSignal('live');
      await clearAgeGateStorage();
      await signOutLocally();
      setAskAge(true);
      setPhase('consent');
    });
  }, [enqueueWork]);

  const simulate = useCallback(
    (signal: DevAgeSignal) => {
      setDevAgeSignal(signal);
      return refresh();
    },
    [refresh],
  );

  useEffect(() => onAgeGateRefresh(() => void refresh()), [refresh]);

  useEffect(() => {
    void refresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });
    const network = Network.addNetworkStateListener((state) => {
      if (!state.isConnected) {
        return;
      }
      void enqueueWork(async () => {
        if (await loadPendingDeletion()) {
          if (await eraseUnder13()) {
            await setPendingDeletion(false);
          }
        }
        await flushConsentRecords();
      });
    });
    return () => {
      appState.remove();
      network.remove();
    };
  }, [enqueueWork, refresh]);

  return {
    phase,
    askAge,
    continueYes,
    continueNo,
    acceptUpdatedTerms,
    clear,
    simulate,
  };
}
