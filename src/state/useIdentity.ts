import { useEffect, useState } from 'react';

import {
  getOrCreateInstallId,
  getSessionUserId,
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

    void (async () => {
      const id = await getOrCreateInstallId();
      const sessionUserId = await getSessionUserId();
      if (cancelled) {
        return;
      }
      setInstallId(id);
      setUserId(sessionUserId);
      setReady(true);

      const supabase = getSupabase();
      if (!supabase) {
        return;
      }
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const next = session?.user.id ?? null;
        setCachedUserId(next);
        setUserId(next);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return {
    ready,
    installId,
    ownerId: userId ?? installId,
  };
}
