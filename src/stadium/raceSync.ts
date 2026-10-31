import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { getSupabase } from '../compliance/supabase';
import { liveChanged, packLiveState, parseLiveState, pushSample, raceSyncConfig, type LiveState, type LiveTrack } from './liveTrack';

const event = 'run';

/**
 * Streams this phone's runner state and collects every other live player's, keyed by entry id.
 * The map is read from the race tick, so updates never re-render the screen.
 */
export function useRaceSync(raceId: string, live: boolean): {
  remotes: RefObject<Map<string, LiveTrack>>;
  send: (state: LiveState) => void;
} {
  const remotes = useRef(new Map<string, LiveTrack>());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  const last = useRef<{ at: number; state: LiveState | null }>({ at: 0, state: null });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !live) return;
    // Its own topic: the gate's presence channel on race:{id} may still be closing.
    const channel = supabase.channel(`race:${raceId}:run`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;
    channel
      .on('broadcast', { event }, ({ payload }) => {
        const state = parseLiveState(payload);
        if (!state) return;
        remotes.current.set(state.entryId, pushSample(remotes.current.get(state.entryId), state, Date.now()));
      })
      .subscribe((status) => {
        ready.current = status === 'SUBSCRIBED';
      });
    return () => {
      ready.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [live, raceId]);

  const send = useCallback((state: LiveState) => {
    const channel = channelRef.current;
    if (!channel || !ready.current) return;
    const now = Date.now();
    const urgent = liveChanged(last.current.state, state);
    if (state.t === last.current.state?.t && !urgent) return;
    if (!urgent && now - last.current.at < 1000 / raceSyncConfig.syncHz) return;
    last.current = { at: now, state };
    void channel.send({ type: 'broadcast', event, payload: packLiveState(state) });
  }, []);

  return { remotes, send };
}
