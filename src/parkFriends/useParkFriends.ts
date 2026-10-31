import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { readAccountHandle, readAccountLinked } from '../db/accountMeta';
import { refreshShopCatalog } from '../economy/shopSync';
import type { PetState } from '../sim/types';
import { parkFriendRules } from './rules';
import { openParkSession, type ParkMember } from './session';
import { friendNeedsCatalog, offerFromFriend, parkPetSnapshot, type ParkFriendSpawn } from './snapshot';
import { visibleFriends } from './slots';

export function useParkFriends(inPark: boolean, pet: PetState | null): ParkFriendSpawn[] {
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [members, setMembers] = useState<ParkMember[]>([]);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [catalogTick, setCatalogTick] = useState(0);
  const sessionRef = useRef<ReturnType<typeof openParkSession> | null>(null);
  const refreshed = useRef(false);
  const petRef = useRef(pet);
  petRef.current = pet;
  const linked = readAccountLinked();
  const handle = linked ? readAccountHandle() : null;
  const active = inPark && foreground && linked && pet != null && handle != null;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      setForeground(status !== 'background');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const current = petRef.current;
    if (!active || !current || !handle) {
      sessionRef.current?.close();
      sessionRef.current = null;
      setMembers([]);
      setShownIds([]);
      return;
    }
    const session = openParkSession({
      handle,
      pet: parkPetSnapshot(current),
      onRoster: setMembers,
    });
    sessionRef.current = session;
    return () => {
      session.close();
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [active, handle, pet?.id]);

  const equippedKey = pet ? JSON.stringify(pet.equipped) : '';
  useEffect(() => {
    const current = petRef.current;
    if (!active || !current || !sessionRef.current) {
      return;
    }
    sessionRef.current.updatePet(parkPetSnapshot(current));
  }, [active, equippedKey]);

  useEffect(() => {
    const alive = members.filter((member) => Date.now() - member.lastSeen <= parkFriendRules.staleMs);
    setShownIds((current) => {
      const next = visibleFriends(alive, current, parkFriendRules.maxOnScreen).shown.map((friend) => friend.userId);
      return next.join('|') === current.join('|') ? current : next;
    });
  }, [members]);

  useEffect(() => {
    if (refreshed.current || !members.some((member) => friendNeedsCatalog(member.pet))) {
      return;
    }
    refreshed.current = true;
    void refreshShopCatalog().then((ok) => {
      if (ok) {
        setCatalogTick((value) => value + 1);
      }
    });
  }, [members]);

  const byId = new Map(members.map((member) => [member.userId, member]));
  return shownIds.flatMap((id) => {
    const member = byId.get(id);
    if (!member) {
      return [];
    }
    const offer = offerFromFriend(member.userId, member.pet);
    if (!offer) {
      return [];
    }
    void catalogTick;
    return [
      {
        userId: member.userId,
        handle: member.handle,
        enteredAt: member.enteredAt,
        settled: member.settled,
        offer,
      },
    ];
  });
}
