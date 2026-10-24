import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { readAccountLinked } from '../db/accountMeta';
import { rebindOwner } from '../db/bindOwner';
import { bootstrapLocal } from '../db/bootstrap';
import { setCurrentOwner } from '../db/currentOwner';
import { authTransition, setAuthTransition } from './sessionGate';
import {
  getCachedInstallId,
  getCachedUserId,
  getOrCreateInstallId,
  onIdentityReset,
  setBeforeSessionPublish,
  setCachedUserId,
} from '../compliance/identity';
import { pingAuthHealth } from '../compliance/authHealth';
import {
  clearRefreshRetry,
  noteRefreshRetry,
  recoverLinkedSession,
  refreshRetryIsDue,
} from '../compliance/reauth';
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
          if (next) {
            const install = id ?? (await getOrCreateInstallId());
            await rebindOwner(install, next);
            setCurrentOwner(next);
            setCachedUserId(next);
            if (!cancelled) {
              setUserId(next);
            }
            return;
          }
          if (readAccountLinked()) {
            const outcome = await recoverLinkedSession();
            if (outcome.kind === 'restored') {
              clearRefreshRetry();
              setCachedUserId(outcome.userId);
              if (!cancelled) {
                setUserId(outcome.userId);
              }
              return;
            }
            if (outcome.kind === 'dead') {
              clearRefreshRetry();
              setAuthTransition('reauth');
              return;
            }
            noteRefreshRetry();
            return;
          }
          const online = await pingAuthHealth();
          if (!online) {
            return;
          }
          let owner = next;
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
          setCachedUserId(owner);
          if (!cancelled) {
            setUserId(owner);
          }
        })();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active' || !refreshRetryIsDue() || !readAccountLinked() || authTransition() !== 'idle') {
        return;
      }
      void (async () => {
        const outcome = await recoverLinkedSession();
        if (cancelled) {
          return;
        }
        if (outcome.kind === 'restored') {
          clearRefreshRetry();
          setCachedUserId(outcome.userId);
          setUserId(outcome.userId);
          return;
        }
        if (outcome.kind === 'dead') {
          clearRefreshRetry();
          setAuthTransition('reauth');
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.remove();
      setBeforeSessionPublish(null);
      unsubscribe?.();
    };
  }, []);

  useEffect(
    () =>
      onIdentityReset((next) => {
        setInstallId(next);
        setUserId(null);
      }),
    [],
  );

  return {
    ready,
    installId,
    ownerId: userId ?? installId,
  };
}
