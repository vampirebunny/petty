import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ensureCast, loadPlaydateSave, savePlaydateSave, subscribePlaydates } from '../playdate/storage';
import { getCooldownRemaining } from '../playdate/cooldown';
import { onFriendPlaydatePush } from '../playdate/pushNote';
import { syncFriendPlaydates } from '../playdate/share';
import type { PlaydateSave } from '../playdate/types';
import { emptyPlaydateSave } from '../playdate/save';

export function usePlaydates(ownerId: string | undefined) {
  const [save, setSave] = useState<PlaydateSave>(emptyPlaydateSave);
  const [now, setNow] = useState(() => Date.now());
  const saveRef = useRef(save);
  const cooldownWasOn = useRef(false);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getCooldownRemaining(saveRef.current.lastPlaydateCompletedAt, Date.now());
      if (remaining > 0 || cooldownWasOn.current) {
        cooldownWasOn.current = remaining > 0;
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    const pull = () => {
      void loadPlaydateSave(ownerId).then((loaded) => {
        if (cancelled) {
          return;
        }
        const next = ensureCast(loaded, ownerId);
        setSave(next);
        if (next.cast !== loaded.cast) {
          void savePlaydateSave(ownerId, next);
        }
      });
    };
    pull();
    void syncFriendPlaydates(ownerId);
    const unsubscribe = subscribePlaydates(pull);
    const app = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void syncFriendPlaydates(ownerId);
      }
    });
    const pushes = onFriendPlaydatePush(() => {
      void syncFriendPlaydates(ownerId);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      app.remove();
      pushes();
    };
  }, [ownerId]);

  const persist = useCallback(
    (next: PlaydateSave) => {
      setSave(next);
      if (!ownerId) {
        return;
      }
      void savePlaydateSave(ownerId, next).then(() => {
        if (next.history.some((record) => record.syncStatus === 'pending' && !record.incoming)) {
          void syncFriendPlaydates(ownerId);
        }
      });
    },
    [ownerId],
  );

  return {
    save,
    now,
    remaining: getCooldownRemaining(save.lastPlaydateCompletedAt, now),
    persist,
  };
}
