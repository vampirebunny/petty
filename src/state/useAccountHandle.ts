import { useEffect, useState } from 'react';

import { getSupabase } from '../compliance/supabase';
import { onAccountFlags, readAccountHandle, readAccountLinked, setAccountHandle } from '../db/accountMeta';

/** The signed-in account's handle. Null for a guest, or an account that has not picked one yet. */
export function useAccountHandle(): string | null {
  const [tick, setTick] = useState(0);

  useEffect(() => onAccountFlags(() => setTick((value) => value + 1)), []);

  const linked = readAccountLinked();

  useEffect(() => {
    let cancelled = false;
    if (!linked) {
      return;
    }
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        return;
      }
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) {
        return;
      }
      const profile = await supabase.from('profiles').select('handle').eq('user_id', user.id).maybeSingle();
      if (cancelled || profile.error) {
        return;
      }
      const next = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : null;
      setAccountHandle(next && next.length > 0 ? next : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [linked, tick]);

  return linked ? readAccountHandle() : null;
}
