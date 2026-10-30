import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabase } from '../compliance/supabase';

/** One live player's jump, sent once when it lands. */
export type DiveFlagEvent = { entryId: string; attempt: number; m: number; flop: boolean };

const event = 'dive';

function parse(value: unknown): DiveFlagEvent | null {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!row || typeof row.entryId !== 'string') return null;
  const attempt = typeof row.attempt === 'number' ? row.attempt : NaN;
  const m = typeof row.m === 'number' ? row.m : NaN;
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 9 || !Number.isFinite(m) || m < 0 || m > 20) return null;
  return { entryId: row.entryId, attempt, m, flop: row.flop === true };
}

// Other live players' jumps on this race, keyed `${entryId}:${attempt}`. Positions are never streamed.
export function useDiveFlags(raceId: string, live: boolean): {
  others: Record<string, DiveFlagEvent>;
  send: (flag: DiveFlagEvent) => void;
} {
  const [others, setOthers] = useState<Record<string, DiveFlagEvent>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pending = useRef<DiveFlagEvent[]>([]);
  const ready = useRef(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !live) return;
    // Its own topic: the gate's presence channel on race:{id} may still be closing.
    const channel = supabase.channel(`race:${raceId}:dives`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;
    channel
      .on('broadcast', { event }, ({ payload }) => {
        const flag = parse(payload);
        if (flag) setOthers((prev) => ({ ...prev, [`${flag.entryId}:${flag.attempt}`]: flag }));
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        ready.current = true;
        for (const flag of pending.current.splice(0)) void channel.send({ type: 'broadcast', event, payload: flag });
      });
    return () => {
      ready.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [live, raceId]);

  const send = useCallback((flag: DiveFlagEvent) => {
    const channel = channelRef.current;
    if (!channel || !ready.current) {
      pending.current.push(flag);
      return;
    }
    void channel.send({ type: 'broadcast', event, payload: flag });
  }, []);

  return { others, send };
}
