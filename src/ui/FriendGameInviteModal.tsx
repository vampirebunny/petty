import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Users } from 'lucide-react-native';

import { serverNow } from '../db/accountMeta';
import { onFriendGameRequest } from '../friends/open';
import { cancelRaceCall } from '../reminders/notifications';
import {
  conflictCopy,
  fetchInvites,
  friendGameErrorCopy,
  respondInvite,
  type FriendGameConflict,
  type FriendGameInvite,
} from '../stadium/friendGames';
import { gameplayConfig } from '../sim/gameplayConfig';
import { eventLabel, formatCountdown, racesOf, withSignup } from '../sim/stadium';
import type { PetState } from '../sim/types';
import { pushPetBeforeRead } from '../sync/queue';
import { FunModal } from './FunModal';

type Props = {
  pet: PetState;
  linked: boolean;
  /** Hidden while the pet is at a starting gate or racing. */
  hidden: boolean;
  reducedMotion: boolean;
  onCommit: (pet: PetState) => void;
  onJoined: (raceId: string) => void;
};

export function FriendGameInviteModal({ pet, linked, hidden, reducedMotion, onCommit, onJoined }: Props) {
  const [invites, setInvites] = useState<FriendGameInvite[]>([]);
  const [conflict, setConflict] = useState<FriendGameConflict | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => serverNow());
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const petRef = useRef(pet);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!linked) return;
      void fetchInvites().then((result) => {
        if (alive && result.ok) setInvites(result.data);
      });
    };
    refresh();
    const timer = setInterval(refresh, gameplayConfig.friendGames.invitePollMs);
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    const unsub = onFriendGameRequest((raceId) => {
      if (raceId) {
        setFocus(raceId);
        setDismissed((rows) => rows.filter((id) => id !== raceId));
      }
      refresh();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      app.remove();
      unsub();
    };
  }, [linked]);

  const open = invites.filter(
    (row) => !dismissed.includes(row.raceId) && row.startsAt - gameplayConfig.races.lockMs > now,
  );
  const invite = open.find((row) => row.raceId === focus) ?? open[0] ?? null;

  useEffect(() => {
    if (!invite) return;
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, [invite]);

  if (hidden || !linked || !invite) {
    return null;
  }

  const close = (raceId: string) => {
    setDismissed((rows) => [...rows, raceId]);
    setConflict(null);
    setNote(null);
    setInvites((rows) => rows.filter((row) => row.raceId !== raceId));
  };

  const accept = async (replace: boolean) => {
    if (busy) return;
    setBusy(true);
    let result = await respondInvite(invite.raceId, 'accept', petRef.current.id, replace);
    if (!result.ok && /pet not synced/i.test(result.error)) {
      const pushed = await pushPetBeforeRead(petRef.current);
      if (pushed.pet !== petRef.current) {
        petRef.current = pushed.pet;
        onCommit(pushed.pet);
      }
      if (!pushed.reason) {
        result = await respondInvite(invite.raceId, 'accept', pushed.pet.id, replace);
      }
    }
    setBusy(false);
    if (!result.ok) {
      if ('conflict' in result) {
        setConflict(result.conflict);
        return;
      }
      setConflict(null);
      setNote(friendGameErrorCopy(result.error));
      return;
    }
    if (replace && conflict && conflict.cup !== 'friends' && racesOf(petRef.current).signup) {
      void cancelRaceCall();
      onCommit(withSignup(petRef.current, null, serverNow()));
    }
    const raceId = invite.raceId;
    close(raceId);
    onJoined(raceId);
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    await respondInvite(invite.raceId, 'decline', null, false);
    setBusy(false);
    close(invite.raceId);
  };

  if (note) {
    return (
      <FunModal
        title="Friend game"
        body={note}
        icon={Users}
        tint="lilac"
        reducedMotion={reducedMotion}
        primary={{ label: 'OK', onPress: () => close(invite.raceId) }}
      />
    );
  }

  if (conflict) {
    return (
      <FunModal
        title="Already in a race"
        body={conflictCopy(conflict, pet.name, 'join')}
        icon={Users}
        tint="lilac"
        reducedMotion={reducedMotion}
        primary={{ label: busy ? 'Joining…' : 'Join this game', onPress: () => void accept(true) }}
        secondary={{ label: 'Not now', onPress: () => close(invite.raceId) }}
      />
    );
  }

  const event = invite.event ? eventLabel(invite.event) : 'a race';
  return (
    <FunModal
      title="Friend game invite"
      body={`@${invite.hostHandle}${invite.hostPetName ? ` and ${invite.hostPetName}` : ''} invited ${pet.name} to a ${event} friend game. Starts in ${formatCountdown(invite.startsAt - now)}.`}
      icon={Users}
      tint="lilac"
      sparkle
      reducedMotion={reducedMotion}
      primary={{ label: busy ? 'Joining…' : 'Accept', onPress: () => void accept(false) }}
      secondary={{ label: 'Decline', onPress: () => void decline() }}
    />
  );
}
