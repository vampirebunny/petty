import { useEffect, useState } from 'react';

import { bindInstallToAuth } from '../db/bindOwner';
import { bootstrapLocal } from '../db/bootstrap';
import { setCurrentOwner } from '../db/currentOwner';
import {
  getCachedInstallId,
  getCachedUserId,
  getOrCreateInstallId,
  setBeforeSessionPublish,
  setCachedUserId,
} from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';

export type Identity = {
  ready: boolean;
  installId: string | null;
  ownerId: string | null;
};

export function useIdentity(): Identity {
  const [ready, setReady] = useState(false);
  const [installId, setInstallId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    setBeforeSessionPublish(async (nextUserId) => {
      const install = await getOrCreateInstallId();
      await bindInstallToAuth(install, nextUserId);
      setCurrentOwner(nextUserId);
    });

    void (async () => {
      await bootstrapLocal();
      if (cancelled) {
        return;
      }
      const id = getCachedInstallId();
      const sessionUserId = getCachedUserId();
      setInstallId(id);
      setUserId(sessionUserId);
      setReady(true);

      const supabase = getSupabase();
      if (!supabase) {
        return;
      }
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const next = session?.user.id ?? null;
        if (!next && event !== 'SIGNED_OUT') {
          return;
        }
        void (async () => {
          if (next) {
            const install = id ?? (await getOrCreateInstallId());
            await bindInstallToAuth(install, next);
            setCurrentOwner(next);
          } else if (id) {
            setCurrentOwner(id);
          }
          setCachedUserId(next);
          if (!cancelled) {
            setUserId(next);
          }
        })();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      setBeforeSessionPublish(null);
      unsubscribe?.();
    };
  }, []);

  return {
    ready,
    installId,
    ownerId: userId ?? installId,
  };
}
