import { useEffect, useRef, useState } from 'react';

import { track } from '../analytics/analytics';
import { serverNow } from '../db/accountMeta';
import type { PetState } from '../sim/types';
import { fetchBoard } from '../stadium/api';
import { inviteConfig } from './config';
import { boardRaceOptions, createInvitation } from './create';
import { retargetRace } from './pick';
import { dismissFormat } from './schedule';
import { updateCounters } from './store';
import { onInviteMoment, onNpcInviteRequest } from './session';
import type { Invitation } from './types';

type Args = {
  pet: PetState | null;
  linked: boolean;
  home: boolean;
  blocked: boolean;
  onAccept: (invitation: Invitation) => void;
};

export function useNpcInvitation({ pet, linked, home, blocked, onAccept }: Args): {
  invitation: Invitation | null;
  dismiss: (method: 'button' | 'tap_outside') => void;
  accept: () => void;
  due: (opened: boolean) => void;
  opened: () => void;
} {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [pulse, setPulse] = useState(0);
  const shownAt = useRef(0);
  const openedTracked = useRef(false);
  const busy = useRef(false);
  const pushPending = useRef(false);
  const argsRef = useRef({ pet, linked, home, blocked, onAccept });

  useEffect(() => {
    argsRef.current = { pet, linked, home, blocked, onAccept };
  }, [blocked, home, linked, onAccept, pet]);

  useEffect(() => onInviteMoment(() => setPulse((value) => value + 1)), []);
  useEffect(
    () =>
      onNpcInviteRequest(() => {
        pushPending.current = true;
        setPulse((value) => value + 1);
      }),
    [],
  );

  useEffect(() => {
    if (!pet || !home || blocked || invitation || busy.current || pulse === 0) {
      return;
    }
    const fromPush = pushPending.current;
    if (!fromPush && pulse === 0) {
      return;
    }
    pushPending.current = false;
    let cancel = false;
    busy.current = true;
    void createInvitation(pet, fromPush ? 'push' : 'in_app', linked).then((next) => {
      if (cancel) {
        return;
      }
      busy.current = false;
      if (!next || !argsRef.current.home || argsRef.current.blocked) {
        return;
      }
      shownAt.current = Date.now();
      openedTracked.current = false;
      setInvitation(next);
    });
    return () => {
      cancel = true;
      busy.current = false;
    };
  }, [blocked, home, invitation, linked, pet, pulse]);

  const dismiss = (method: 'button' | 'tap_outside') => {
    const current = invitation;
    const ownerId = argsRef.current.pet?.ownerId;
    if (!current || !ownerId) {
      setInvitation(null);
      return;
    }
    track('invite_dismissed', { type: current.type, method });
    void updateCounters(ownerId, (counters) => dismissFormat(counters, current.type, Date.now()));
    setInvitation(null);
  };

  const accept = () => {
    const current = invitation;
    if (!current) {
      return;
    }
    const retargeted = current.type === 'race' && current.startsAt < serverNow() + inviteConfig.leadMs ? 1 : 0;
    track('invite_accepted', { type: current.type, retargeted });
    setInvitation(null);
    argsRef.current.onAccept(current);
  };

  const opened = () => {
    const current = invitation;
    if (!current || openedTracked.current) {
      return;
    }
    openedTracked.current = true;
    track('invite_opened', { type: current.type, seconds_to_open: secondsToOpen(shownAt.current) });
  };

  const due = (envelopeOpen: boolean) => {
    const current = invitation;
    const petId = argsRef.current.pet?.id;
    if (!current) {
      return;
    }
    if (!envelopeOpen || current.type === 'runway') {
      track('invite_expired', { type: current.type });
      setInvitation(null);
      return;
    }
    if (!petId) {
      track('invite_expired', { type: 'race' });
      setInvitation(null);
      return;
    }
    void fetchBoard(petId).then((board) => {
      if (!board.ok) {
        track('invite_expired', { type: 'race' });
        setInvitation(null);
        return;
      }
      const next = retargetRace(boardRaceOptions(board.data), current.event, serverNow());
      if (!next) {
        track('invite_expired', { type: 'race' });
        setInvitation(null);
        return;
      }
      setInvitation({
        ...current,
        eventId: next.eventId,
        event: next.event,
        cup: next.cup,
        classId: next.classId,
        startsAt: next.startsAt,
        expiresAt: next.startsAt,
      });
    });
  };

  return { invitation, dismiss, accept, due, opened };
}

export function secondsToOpen(shownAt: number, now = Date.now()): number {
  return Math.max(0, Math.round((now - shownAt) / 1000));
}
