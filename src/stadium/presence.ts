import { useEffect, useState } from 'react';

import { getSupabase } from '../compliance/supabase';

// Entry ids of the players on this race's starting gate right now, including this one.
export function useGatePresence(raceId: string | null, entryId: string | null): string[] {
  const [present, setPresent] = useState<string[]>([]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !raceId || !entryId) {
      return;
    }
    const channel = supabase.channel(`race:${raceId}`, { config: { presence: { key: entryId } } });
    const refresh = () => setPresent(Object.keys(channel.presenceState()));
    channel
      .on('presence', { event: 'sync' }, refresh)
      .on('presence', { event: 'join' }, refresh)
      .on('presence', { event: 'leave' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ entryId });
        }
      });
    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      setPresent([]);
    };
  }, [raceId, entryId]);

  return present;
}
