import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadCoachSeen } from '../../cuddle/guidance';
import { canOffer, phaseAfter, phaseOnShow } from './tipState';
import type { TipId, TipPhase } from './tipState';

const storageKey = 'petty.tips';

type Store = {
  phases: Partial<Record<TipId, TipPhase>>;
  propTaps: number;
};

const empty: Store = { phases: {}, propTaps: 0 };

export function useCandyTips() {
  const [store, setStore] = useState<Store>(empty);
  const [current, setCurrent] = useState<TipId | null>(null);
  const queue = useRef<TipId[]>([]);
  const storeRef = useRef(store);
  const ready = useRef(false);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const raw = await AsyncStorage.getItem(storageKey);
      const coach = await loadCoachSeen();
      let next = empty;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Store;
          next = {
            phases: parsed.phases ?? {},
            propTaps: parsed.propTaps ?? 0,
          };
        } catch {
          next = empty;
        }
      }
      if (coach && next.phases['tip.cuddle'] !== 'done') {
        next = { ...next, phases: { ...next.phases, 'tip.cuddle': 'done' } };
      }
      if (!cancel) {
        ready.current = true;
        setStore(next);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const persist = useCallback((next: Store) => {
    storeRef.current = next;
    setStore(next);
    void AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }, []);

  const reveal = useCallback(
    (id: TipId) => {
      setCurrent(id);
      const next = phaseOnShow(id, storeRef.current.phases[id]);
      if (next && next !== storeRef.current.phases[id]) {
        persist({ ...storeRef.current, phases: { ...storeRef.current.phases, [id]: next } });
      }
    },
    [persist],
  );

  const showNext = useCallback(() => {
    const phases = storeRef.current.phases;
    while (queue.current.length > 0) {
      const id = queue.current.shift();
      if (id && canOffer(id, phases[id])) {
        reveal(id);
        return;
      }
    }
    setCurrent(null);
  }, [reveal]);

  const offer = useCallback(
    (id: TipId) => {
      if (!ready.current || !canOffer(id, storeRef.current.phases[id])) {
        return;
      }
      if (current === id || queue.current.includes(id)) {
        return;
      }
      if (current) {
        queue.current.push(id);
        return;
      }
      reveal(id);
    },
    [current, reveal],
  );

  const finish = useCallback(
    (id: TipId, event: 'act' | 'dismiss') => {
      const phases = { ...storeRef.current.phases, [id]: phaseAfter(storeRef.current.phases[id], event) };
      persist({ ...storeRef.current, phases });
      if (current === id) {
        setCurrent(null);
        showNext();
      }
    },
    [current, persist, showNext],
  );

  const performed = useCallback(
    (id: TipId) => {
      finish(id, 'act');
    },
    [finish],
  );

  const dismiss = useCallback(() => {
    if (current) {
      finish(current, 'dismiss');
    }
  }, [current, finish]);

  const notePropTap = useCallback(() => {
    const propTaps = storeRef.current.propTaps + 1;
    persist({ ...storeRef.current, propTaps });
    return propTaps;
  }, [persist]);

  const seen = useCallback((id: TipId) => store.phases[id] === 'done', [store.phases]);

  return {
    current,
    propTaps: store.propTaps,
    offer,
    performed,
    dismiss,
    notePropTap,
    seen,
  };
}
