import { useCallback, useEffect, useState } from 'react';

import { ensureCast, loadPlaydateSave, savePlaydateSave, subscribePlaydates } from '../playdate/storage';
import { getCooldownRemaining } from '../playdate/cooldown';
import type { PlaydateSave } from '../playdate/types';
import { emptyPlaydateSave } from '../playdate/save';

export function usePlaydates(ownerId: string | undefined) {
  const [save, setSave] = useState<PlaydateSave>(emptyPlaydateSave);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
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
    const unsubscribe = subscribePlaydates(pull);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ownerId]);

  const persist = useCallback(
    (next: PlaydateSave) => {
      setSave(next);
      if (ownerId) {
        void savePlaydateSave(ownerId, next);
      }
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
