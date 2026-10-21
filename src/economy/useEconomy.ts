import { useCallback, useEffect, useState } from 'react';

import { addStack, emptyEconomy, settleEconomy, spendTreat, type UserEconomy } from './state';
import { loadEconomy, saveEconomy } from './storage';

export function useEconomy(ownerId: string | undefined) {
  const [economy, setEconomy] = useState<UserEconomy | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    void loadEconomy(ownerId).then((loaded) => {
      if (cancelled) {
        return;
      }
      setEconomy(loaded);
      setLoadedOwner(ownerId);
      void saveEconomy(ownerId, loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const current = ownerId != null && loadedOwner === ownerId ? economy : null;

  const commit = useCallback(
    (next: UserEconomy) => {
      setEconomy(next);
      if (ownerId) {
        void saveEconomy(ownerId, next);
      }
    },
    [ownerId],
  );

  const refresh = useCallback(() => {
    if (!current) {
      return;
    }
    commit(settleEconomy(current, Date.now()));
  }, [commit, current]);

  const give = useCallback(
    (itemId: string): boolean => {
      if (!current) {
        return false;
      }
      const spent = spendTreat(settleEconomy(current, Date.now()), itemId);
      if (!spent.ok) {
        return false;
      }
      commit(spent.economy);
      return true;
    },
    [commit, current],
  );

  const grant = useCallback(
    (itemId: string, qty: number) => {
      const base = current ?? emptyEconomy(Date.now());
      commit(addStack(base, itemId, qty));
    },
    [commit, current],
  );

  const grantMany = useCallback(
    (items: { itemId: string; qty: number }[]) => {
      let next = current ?? emptyEconomy(Date.now());
      for (const item of items) {
        if (item.qty > 0) {
          next = addStack(next, item.itemId, item.qty);
        }
      }
      commit(next);
    },
    [commit, current],
  );

  return { economy: current, refresh, give, grant, grantMany };
}
