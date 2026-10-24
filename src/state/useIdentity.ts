import { useEffect, useState } from 'react';

import { readAccountLinked } from '../db/accountMeta';
import { rebindOwner } from '../db/bindOwner';
import { bootstrapLocal } from '../db/bootstrap';
import { setCurrentOwner } from '../db/currentOwner';
import { authTransition, setAuthTransition } from './sessionGate';
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
      if (authTransition() !== 'idle') {
        return;
      }
      const install = await getOrCreateInstallId();
      await rebindOwner(install, nextUserId);
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
          if (authTransition() !== 'idle') {
            setCachedUserId(next);
            if (!cancelled) {
              setUserId(next);
            }
            return;
          }
          let owner = next;
          if (next) {
            const install = id ?? (await getOrCreateInstallId());
            await rebindOwner(install, next);
            setCurrentOwner(next);
          } else if (readAccountLinked()) {
            setAuthTransition('reauth');
          } else {
            const previous = getCachedUserId();
            if (previous) {
              const { ensureAnonymousUserId } = await import('../compliance/identity');
              const created = await ensureAnonymousUserId();
              if (created && created !== previous) {
                await rebindOwner(previous, created);
                setCurrentOwner(created);
                owner = created;
              }
            } else if (id) {
              setCurrentOwner(id);
            }
          }
          setCachedUserId(owner);
          if (!cancelled) {
            setUserId(owner);
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
