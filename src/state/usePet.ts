import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { advance, applyEvent, createPet, deriveMood, openTickMs } from '../sim';
import type { Cue, Mood, PetEvent, PetState } from '../sim';
import { asyncPetStorage } from '../storage/asyncStorage';
import type { PetStorage } from '../storage/PetStorage';

export type PetCue = {
  kind: Cue['kind'];
  token: number;
};

type PetApi = {
  state: PetState | null;
  mood: Mood | null;
  cue: PetCue;
  feed: () => void;
  rest: () => void;
  pet: () => void;
  advanceBy: (elapsedMs: number) => void;
  reset: () => void;
};

function changed(current: PetState, next: PetState): boolean {
  return (
    current.asleep !== next.asleep ||
    current.lastUpdatedAt !== next.lastUpdatedAt ||
    current.rngState !== next.rngState ||
    current.needs.fullness !== next.needs.fullness ||
    current.needs.energy !== next.needs.energy ||
    current.needs.happiness !== next.needs.happiness
  );
}

export function usePet(storage: PetStorage = asyncPetStorage): PetApi {
  const [state, setState] = useState<PetState | null>(null);
  const [cue, setCue] = useState<PetCue>({ kind: 'none', token: 0 });
  const stateRef = useRef<PetState | null>(null);
  const tokenRef = useRef(0);
  const storageRef = useRef(storage);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    storageRef.current = storage;
  }, [storage]);

  const publish = useCallback((next: PetState, nextCue?: Cue) => {
    stateRef.current = next;
    setState(next);
    if (nextCue) {
      tokenRef.current += 1;
      setCue({ kind: nextCue.kind, token: tokenRef.current });
    }
    console.log(next);
    const snapshot = next;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => storageRef.current.save(snapshot));
  }, []);

  const advanceFromClock = useCallback(
    (now: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const next = advance(current, now - current.lastUpdatedAt);
      if (changed(current, next)) {
        publish(next);
      }
    },
    [publish],
  );

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();
    void storage.load().then((loaded) => {
      if (cancelled) {
        return;
      }
      const base = loaded ?? createPet(startedAt, startedAt);
      publish(advance(base, Date.now() - base.lastUpdatedAt));
    });
    return () => {
      cancelled = true;
    };
  }, [publish, storage]);

  useEffect(() => {
    const timer = setInterval(() => advanceFromClock(Date.now()), openTickMs);
    return () => clearInterval(timer);
  }, [advanceFromClock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        advanceFromClock(Date.now());
      }
    });
    return () => subscription.remove();
  }, [advanceFromClock]);

  const dispatch = useCallback(
    (event: PetEvent) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const result = applyEvent(current, event);
      publish(result.state, result.cue);
    },
    [publish],
  );

  const advanceBy = useCallback(
    (elapsedMs: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      publish(advance(current, elapsedMs));
    },
    [publish],
  );

  const reset = useCallback(() => {
    const now = Date.now();
    publish(createPet(now, now), { kind: 'none' });
  }, [publish]);

  const feed = useCallback(() => dispatch({ type: 'feed' }), [dispatch]);
  const rest = useCallback(() => dispatch({ type: 'toggleRest' }), [dispatch]);
  const pet = useCallback(() => dispatch({ type: 'pet' }), [dispatch]);

  return {
    state,
    mood: state ? deriveMood(state) : null,
    cue,
    feed,
    rest,
    pet,
    advanceBy,
    reset,
  };
}
