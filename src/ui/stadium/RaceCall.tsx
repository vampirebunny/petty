import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react-native';

import { arcadeRoundRunning } from '../../audio/arcadeMusic';
import { serverNow } from '../../db/accountMeta';
import { cancelRaceCall } from '../../reminders/notifications';
import { withdrawEntry } from '../../stadium/api';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { eventLabel, formatCountdown, gatePhase, racesOf, withSignup } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { FunModal } from '../FunModal';
import { Toast } from './parts';

type Props = {
  pet: PetState;
  atGate: boolean;
  reducedMotion: boolean;
  onGo: () => void;
  onCommit: (pet: PetState) => void;
};

// A mini-game run keeps going until this close to the line-up lock, then the call shows anyway.
const holdForRunMs = 20_000;

// The in-app race call: shows once the gate opens, wherever the player is except the gate itself.
export function RaceCall({ pet, atGate, reducedMotion, onGo, onCommit }: Props) {
  const signup = racesOf(pet).signup;
  const [now, setNow] = useState(() => serverNow());
  const [running, setRunning] = useState(() => arcadeRoundRunning());
  const [skipped, setSkipped] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const petRef = useRef(pet);
  const commitRef = useRef(onCommit);

  useEffect(() => {
    petRef.current = pet;
    commitRef.current = onCommit;
  }, [onCommit, pet]);

  const startsAt = signup?.startsAt ?? null;
  useEffect(() => {
    if (startsAt == null) {
      return;
    }
    const timer = setInterval(() => {
      setNow(serverNow());
      setRunning(arcadeRoundRunning());
    }, 1000);
    return () => clearInterval(timer);
  }, [startsAt]);

  const hideToast = useCallback(() => setToast(null), []);

  const lockAt = (startsAt ?? 0) - gameplayConfig.races.lockMs;
  const waitForRun = running && lockAt - now > holdForRunMs;
  const show =
    signup != null && !atGate && skipped !== signup.entryId && gatePhase(signup.startsAt, now) === 'gate' && !waitForRun;

  const skip = async () => {
    if (!signup) {
      return;
    }
    setSkipped(signup.entryId);
    const result = await withdrawEntry(signup.entryId);
    if (!result.ok && !result.offline) {
      setToast('The line-up is locked now.');
      return;
    }
    if (!result.ok) {
      setToast('The Stadium needs internet to race.');
      return;
    }
    void cancelRaceCall();
    commitRef.current(withSignup(petRef.current, null, serverNow()));
    setToast(`You've withdrawn from ${eventLabel(signup.event)}`);
  };

  return (
    <>
      {show && signup ? (
        <FunModal
          title="The gate is open!"
          body={`RACE CALL · ${eventLabel(signup.event)} starts in ${formatCountdown(signup.startsAt - now)}`}
          icon={Flag}
          tint="mint"
          sparkle
          reducedMotion={reducedMotion}
          primary={{ label: 'Go to the starting gate', onPress: onGo, closeFirst: true }}
          secondary={{ label: 'Skip this race', onPress: () => void skip() }}
        />
      ) : null}
      {toast ? <Toast message={toast} reducedMotion={reducedMotion} onDone={hideToast} /> : null}
    </>
  );
}
