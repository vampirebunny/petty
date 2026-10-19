import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { flickToThrow } from '../input/flick';
import { cancelReminders, syncReminder } from '../reminders/notifications';
import {
  applyEvent,
  applyWeightDelta,
  createPet,
  debugJump,
  deriveMood,
  openTickMs,
  resume,
  setAgeDays,
  setVitality,
  setWeight,
  tickForeground,
} from '../sim';
import type { Cue, Look, Mood, OutfitSlot, PetAttributes, PetEvent, PetState } from '../sim';
import { clearDraft } from '../storage/session';
import { loadRemindersEnabled, saveRemindersEnabled } from '../storage/session';
import { asyncPetStorage } from '../storage/asyncStorage';
import type { PetStorage } from '../storage/PetStorage';

export type PetCue = {
  kind: Cue['kind'];
  token: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
};

type PetApi = {
  ready: boolean;
  state: PetState | null;
  mood: Mood | null;
  cue: PetCue;
  remindersOn: boolean;
  setRemindersOn: (enabled: boolean) => void;
  idle: () => void;
  sit: () => void;
  givePaw: () => void;
  speak: () => void;
  feed: () => void;
  refillWater: () => void;
  reportDrank: (fromBowl: boolean) => void;
  rest: () => void;
  pet: () => void;
  startCuddle: () => void;
  finishCuddle: (seconds: number) => void;
  fetchBall: () => void;
  throwAt: (x: number, y: number) => void;
  flickAt: (x: number, y: number, vx: number, vy: number) => void;
  setScene: (sceneId: string) => void;
  equip: (slot: OutfitSlot, itemId: string | null) => void;
  applyActorWeight: (delta: number) => void;
  advanceBy: (elapsedMs: number) => void;
  setAge: (ageDays: number) => void;
  setVitalityValue: (vitality: number) => void;
  setWeightValue: (weight: number) => void;
  reset: () => void;
  release: () => void;
  adopt: (breedId: string, attributes: PetAttributes, look: Look, name: string) => void;
};

export function usePet(storage: PetStorage = asyncPetStorage): PetApi {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PetState | null>(null);
  const [cue, setCue] = useState<PetCue>({ kind: 'none', token: 0 });
  const [remindersOn, setRemindersOnState] = useState(true);
  const stateRef = useRef<PetState | null>(null);
  const tokenRef = useRef(0);
  const storageRef = useRef(storage);
  const remindersRef = useRef(true);
  const saveQueue = useRef(Promise.resolve());
  const activeRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    storageRef.current = storage;
  }, [storage]);

  const publish = useCallback((next: PetState, nextCue?: Cue) => {
    stateRef.current = next;
    setState(next);
    if (nextCue) {
      tokenRef.current += 1;
      setCue({
        kind: nextCue.kind,
        token: tokenRef.current,
        drop: nextCue.drop,
        flick: nextCue.flick,
      });
    }
    const snapshot = next;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => storageRef.current.save(snapshot))
      .then(() => syncReminder(snapshot, remindersRef.current))
      .then((allowed) => {
        if (remindersRef.current && !allowed) {
          remindersRef.current = false;
          setRemindersOnState(false);
          return saveRemindersEnabled(false);
        }
        return undefined;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([storage.load(), loadRemindersEnabled()]).then(([loaded, reminders]) => {
      if (cancelled) {
        return;
      }
      remindersRef.current = reminders;
      setRemindersOnState(reminders);
      setReady(true);
      if (loaded) {
        publish(resume(loaded, Date.now()));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [publish, storage]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current || !activeRef.current) {
        return;
      }
      publish(tickForeground(current, Date.now()));
    }, openTickMs);
    return () => clearInterval(timer);
  }, [publish]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      const active = status === 'active';
      const becameActive = active && !activeRef.current;
      activeRef.current = active;
      const current = stateRef.current;
      if (becameActive && current) {
        publish(resume(current, Date.now()));
      }
    });
    return () => subscription.remove();
  }, [publish]);

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
      publish(debugJump(current, elapsedMs));
    },
    [publish],
  );

  const setAge = useCallback(
    (ageDays: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      publish(setAgeDays(current, ageDays));
    },
    [publish],
  );

  const setVitalityValue = useCallback(
    (vitality: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      publish(setVitality(current, vitality));
    },
    [publish],
  );

  const setWeightValue = useCallback(
    (weight: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      publish(setWeight(current, weight));
    },
    [publish],
  );

  const reset = useCallback(() => {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    // Reuse the stored attributes and look: a reset must not regenerate potential from today's breed ranges.
    publish(
      createPet({
        id: current.id,
        name: current.name,
        breedId: current.breedId,
        look: current.look,
        attributes: current.attributes,
        now: Date.now(),
      }),
      { kind: 'none' },
    );
  }, [publish]);

  // Deletes the pet for good. The delete rides the same queue as every save, so a pending
  // save cannot write the old pet back, and the tick skips while no pet is loaded.
  const release = useCallback(() => {
    if (!stateRef.current) {
      return;
    }
    stateRef.current = null;
    // Start the draft delete before the adoption screen mounts and reads the draft.
    const draftCleared = clearDraft();
    setState(null);
    tokenRef.current += 1;
    setCue({ kind: 'none', token: tokenRef.current });
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => draftCleared)
      .then(() => storageRef.current.clear())
      .then(() => cancelReminders())
      .catch(() => undefined);
  }, []);

  const adopt = useCallback(
    (breedId: string, attributes: PetAttributes, look: Look, name: string) => {
      const now = Date.now();
      const id = `${attributes.seed}-${attributes.archetype}-${now.toString(36)}`;
      publish(createPet({ id, name, breedId, look, attributes, now }), { kind: 'none' });
      void clearDraft();
    },
    [publish],
  );

  const setRemindersOn = useCallback((enabled: boolean) => {
    remindersRef.current = enabled;
    setRemindersOnState(enabled);
    void saveRemindersEnabled(enabled).then(() => {
      const current = stateRef.current;
      if (!current) {
        return undefined;
      }
      return syncReminder(current, enabled).then((allowed) => {
        if (enabled && !allowed) {
          remindersRef.current = false;
          setRemindersOnState(false);
          return saveRemindersEnabled(false);
        }
        return undefined;
      });
    });
  }, []);

  const applyActorWeight = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      publish(applyWeightDelta(current, delta));
    },
    [publish],
  );

  const idle = useCallback(() => dispatch({ type: 'idle' }), [dispatch]);
  const sit = useCallback(() => dispatch({ type: 'sit' }), [dispatch]);
  const givePaw = useCallback(() => dispatch({ type: 'paw' }), [dispatch]);
  const speak = useCallback(() => dispatch({ type: 'speak' }), [dispatch]);
  const feed = useCallback(() => dispatch({ type: 'feed' }), [dispatch]);
  const refillWater = useCallback(() => dispatch({ type: 'refillWater' }), [dispatch]);
  const reportDrank = useCallback(
    (fromBowl: boolean) => dispatch({ type: 'drank', fromBowl, now: Date.now() }),
    [dispatch],
  );
  const rest = useCallback(() => dispatch({ type: 'toggleRest' }), [dispatch]);
  const pet = useCallback(() => dispatch({ type: 'pet' }), [dispatch]);
  const startCuddle = useCallback(() => dispatch({ type: 'cuddleStart' }), [dispatch]);
  const finishCuddle = useCallback((seconds: number) => dispatch({ type: 'cuddled', seconds }), [dispatch]);
  const fetchBall = useCallback(() => dispatch({ type: 'fetch' }), [dispatch]);
  const throwAt = useCallback(
    (x: number, y: number) => dispatch({ type: 'fetch', drop: { x, y } }),
    [dispatch],
  );
  const flickAt = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      dispatch({ type: 'fetch', drop: { x, y }, flick: flickToThrow(vx, vy) });
    },
    [dispatch],
  );
  const setScene = useCallback(
    (sceneId: string) => dispatch({ type: 'setScene', sceneId }),
    [dispatch],
  );
  const equip = useCallback(
    (slot: OutfitSlot, itemId: string | null) => dispatch({ type: 'equip', slot, itemId }),
    [dispatch],
  );

  return {
    ready,
    state,
    mood: state ? deriveMood(state) : null,
    cue,
    remindersOn,
    setRemindersOn,
    idle,
    sit,
    givePaw,
    speak,
    feed,
    refillWater,
    reportDrank,
    rest,
    pet,
    startCuddle,
    finishCuddle,
    fetchBall,
    throwAt,
    flickAt,
    setScene,
    equip,
    applyActorWeight,
    advanceBy,
    setAge,
    setVitalityValue,
    setWeightValue,
    reset,
    release,
    adopt,
  };
}
