import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag } from 'lucide-react-native';

import { arcadeRoundRunning } from '../../audio/arcadeMusic';
import { serverNow } from '../../db/accountMeta';
import { cancelRaceCall } from '../../reminders/notifications';
import { withdrawEntry } from '../../stadium/api';
import { leaveFriendGame } from '../../stadium/friendGames';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { eventLabel, formatCountdown, gatePhase, racesOf, withFriendGame, withSignup } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { setRaceCallOpen } from '../../petCam/session';
import { FunModal } from '../FunModal';
import { Toast } from './parts';

type Props = {
  pet: PetState;
  atGate: boolean;
  reducedMotion: boolean;
  onGo: () => void;
  /** Open this friend game's waiting room. */
  onFriendGo: (raceId: string) => void;
  onCommit: (pet: PetState) => void;
};

// A mini-game run keeps going until this close to the line-up lock, then the call shows anyway.
const holdForRunMs = 20_000;

// The in-app race call: shows callMs before the start, wherever the player is except the gate itself.
export function RaceCall({ pet, atGate, reducedMotion, onGo, onFriendGo, onCommit }: Props) {
  const record = racesOf(pet);
  const signup = record.signup;
  const friend = record.friendGame;
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

  const clockAt = signup || friend ? `${signup?.startsAt ?? 0}:${friend?.startsAt ?? 0}` : '';
  useEffect(() => {
    if (!clockAt) {
      return;
    }
    const timer = setInterval(() => {
      setNow(serverNow());
      setRunning(arcadeRoundRunning());
    }, 1000);
    return () => clearInterval(timer);
  }, [clockAt]);

  const hideToast = useCallback(() => setToast(null), []);

  const inGate = (startsAt: number, id: string) =>
    skipped !== id && now >= startsAt - gameplayConfig.races.callMs && gatePhase(startsAt, now) === 'gate';
  const friendDue = friend != null && inGate(friend.startsAt, friend.raceId);
  const signupDue = signup != null && inGate(signup.startsAt, signup.entryId);
  const showingFriend = friendDue && friend != null && (!signupDue || !signup || friend.startsAt <= signup.startsAt);
  const mode = showingFriend && friend ? 'friend' : signupDue && signup ? 'signup' : null;
  const active = mode === 'friend' ? friend : mode === 'signup' ? signup : null;
  const lockAt = (active?.startsAt ?? 0) - gameplayConfig.races.lockMs;
  const waitForRun = running && active != null && lockAt - now > holdForRunMs;
  const show = active != null && !atGate && !waitForRun;

  useEffect(() => {
    setRaceCallOpen(show);
    return () => setRaceCallOpen(false);
  }, [show]);

  const skip = async () => {
    if (!active) {
      return;
    }
    if (!signup || mode !== 'signup') {
      if (!friend) return;
      setSkipped(friend.raceId);
      const result = await leaveFriendGame(friend.raceId);
      if (!result.ok) {
        setToast(result.offline ? 'The Stadium needs internet to race.' : 'The line-up is locked now.');
        return;
      }
      void cancelRaceCall();
      commitRef.current(withFriendGame(petRef.current, null, serverNow()));
      setToast(result.data.cancelled ? 'You cancelled the friend game.' : `You've withdrawn from ${eventLabel(friend.event)}`);
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
      {show && active ? (
        <FunModal
          title="The gate is open!"
          body={`RACE CALL · ${eventLabel(active.event)} starts in ${formatCountdown(active.startsAt - now)}`}
          icon={Flag}
          tint="mint"
          sparkle
          reducedMotion={reducedMotion}
          primary={{
            label: 'Go to the starting gate',
            onPress: () => (mode === 'friend' && friend ? onFriendGo(friend.raceId) : onGo()),
          }}
          secondary={{ label: 'Skip this race', onPress: () => void skip() }}
        />
      ) : null}
      {toast ? <Toast message={toast} reducedMotion={reducedMotion} onDone={hideToast} /> : null}
    </>
  );
}
