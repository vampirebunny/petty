import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { flickToThrow } from '../input/flick';
import { cancelReminders, syncReminder } from '../reminders/notifications';
import { AWAY_DECAY } from '../sim/awayDecayConfig';
import { awayElapsedHours } from '../sim/awayDecay';
import { applyRewardTreat, giveTreat } from '../treats/rules';
import {
  applyEvent,
  applyEnergyDelta,
  applyHappinessDelta,
  applyHungerDelta,
  applyHydrationDelta,
  applyWeightDelta,
  createPet,
  debugJump,
  deriveMood,
  openTickMs,
  resolveReward,
  resume,
  setAgeDays,
  setVitality,
  setWeight,
  tickForeground,
} from '../sim';
import type { Cue, Look, Mood, OutfitSlot, PetAttributes, PetEvent, PetState, Trait } from '../sim';
import { getCachedOwnerId } from '../compliance/identity';
import { clearPetPlaydates } from '../playdate/storage';
import { asyncPetStorage } from '../storage/asyncStorage';
import type { PetStorage } from '../storage/PetStorage';
import {
  clearDraft,
  loadCareRemindersEnabled,
  loadRemindersEnabled,
  saveCareRemindersEnabled,
  saveRemindersEnabled,
} from '../storage/session';

export type PetCue = {
  kind: Cue['kind'];
  token: number;
  drop?: { x: number; y: number };
  flick?: { vx: number; vy: number; vz: number };
  elapsedH?: number;
  treatId?: string;
  moodGain?: number;
};

type PetApi = {
  ready: boolean;
  state: PetState | null;
  mood: Mood | null;
  cue: PetCue;
  remindersOn: boolean;
  setRemindersOn: (enabled: boolean) => void;
  careRemindersOn: boolean;
  setCareRemindersOn: (enabled: boolean) => void;
  setCareTreatCount: (count: number) => void;
  idle: () => void;
  sit: () => void;
  givePaw: () => void;
  speak: () => void;
  feed: () => void;
  refillWater: () => void;
  reportDrank: (fromBowl: boolean) => void;
  reportAte: () => void;
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
  applyActorEnergy: (delta: number) => void;
  applyActorHunger: (delta: number) => void;
  applyActorHydration: (delta: number) => void;
  applyActorHappiness: (delta: number) => boolean;
  advanceBy: (elapsedMs: number) => void;
  setAge: (ageDays: number) => void;
  setVitalityValue: (vitality: number) => void;
  setWeightValue: (weight: number) => void;
  reset: () => void;
  release: () => void;
  attemptTrick: (trackId: string) => { ok: boolean; mastered: boolean; confused: boolean } | null;
  resolveTraining: (choice: 'treat' | 'none') => { before: PetState; after: PetState } | null;
  seeCoach: (id: string) => void;
  moveFurniture: (pieceId: string, sceneId: string, x: number, y: number) => void;
  rememberGreeting: (id: string) => void;
  clearTreats: () => void;
  offerTreat: (treatId: string) => { ok: true; mood: number } | { ok: false; reason: 'unknown' | 'full' | 'species' };
  welcomeBack: boolean;
  dismissWelcome: () => void;
  finishPlaydate: (happiness: number, attributes: Partial<Record<Trait, number>>) => void;
  adopt: (breedId: string, attributes: PetAttributes, look: Look, name: string, ownerId: string) => void;
  setOwnerId: (ownerId: string) => void;
};

export function usePet(storage: PetStorage = asyncPetStorage): PetApi {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PetState | null>(null);
  const [cue, setCue] = useState<PetCue>({ kind: 'none', token: 0 });
  const [remindersOn, setRemindersOnState] = useState(true);
  const [careRemindersOn, setCareRemindersOnState] = useState(false);
  const careRef = useRef(false);
  const treatCountRef = useRef(0);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const stateRef = useRef<PetState | null>(null);
  const tokenRef = useRef(0);
  const storageRef = useRef(storage);
  const remindersRef = useRef(true);
  const saveQueue = useRef(Promise.resolve());
  const activeRef = useRef(AppState.currentState === 'active');
  const returningRef = useRef(false);

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
        elapsedH: nextCue.elapsedH,
        treatId: nextCue.treatId,
        moodGain: nextCue.moodGain,
      });
    }
    const snapshot = next;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => storageRef.current.save(snapshot))
      .then(() =>
        syncReminder(snapshot, remindersRef.current, Date.now(), {
          enabled: careRef.current,
          basicTreats: treatCountRef.current,
        }),
      )
      .then((allowed) => {
        if (remindersRef.current && !allowed) {
          remindersRef.current = false;
          setRemindersOnState(false);
          return saveRemindersEnabled(false);
        }
        return undefined;
      });
  }, []);

  const settleReturn = useCallback(
    (current: PetState, now: number) => {
      if (returningRef.current) {
        return;
      }
      returningRef.current = true;
      try {
        const elapsedH = awayElapsedHours(current.lastUpdatedAt, now);
        if (elapsedH >= AWAY_DECAY.welcomeBackThresholdH) {
          setWelcomeBack(true);
        }
        const awayMin = elapsedH * 60;
        const cue = awayMin >= 2 ? ({ kind: 'greet', elapsedH } as const) : undefined;
        publish(resume(current, now), cue);
      } finally {
        returningRef.current = false;
      }
    },
    [publish],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([storage.load(), loadRemindersEnabled(), loadCareRemindersEnabled()]).then(
      ([loaded, reminders, care]) => {
      if (cancelled) {
        return;
      }
      remindersRef.current = reminders;
      careRef.current = care;
      setRemindersOnState(reminders);
      setCareRemindersOnState(care);
      setReady(true);
      if (loaded) {
        settleReturn(loaded, Date.now());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settleReturn, storage]);

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
      const left = !active && activeRef.current;
      activeRef.current = active;
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const now = Date.now();
      if (left) {
        const resolved = current.care.pendingReward ? resolveReward(current, now, 'none') : current;
        publish({ ...resolved, lastUpdatedAt: now, weightAppliedAt: now });
        return;
      }
      if (becameActive) {
        settleReturn(current, now);
      }
    });
    return () => subscription.remove();
  }, [publish, settleReturn]);

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
    const ownerId = current.ownerId ?? getCachedOwnerId();
    if (ownerId) {
      void clearPetPlaydates(ownerId, current.id);
    }
    if (!ownerId) {
      return;
    }
    // Reuse the stored attributes and look: a reset must not regenerate potential from today's breed ranges.
    publish(
      createPet({
        id: current.id,
        ownerId,
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
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const ownerId = current.ownerId ?? getCachedOwnerId();
    if (ownerId) {
      void clearPetPlaydates(ownerId, current.id);
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
    (breedId: string, attributes: PetAttributes, look: Look, name: string, ownerId: string) => {
      const now = Date.now();
      const id = `${attributes.seed}-${attributes.archetype}-${now.toString(36)}`;
      publish(createPet({ id, ownerId, name, breedId, look, attributes, now }), { kind: 'none' });
      void clearDraft();
    },
    [publish],
  );

  const setOwnerId = useCallback(
    (ownerId: string) => {
      const current = stateRef.current;
      if (!current || current.ownerId === ownerId) {
        return;
      }
      publish({ ...current, ownerId });
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
      return syncReminder(current, enabled, Date.now(), {
        enabled: careRef.current,
        basicTreats: treatCountRef.current,
      }).then((allowed) => {
        if (enabled && !allowed) {
          remindersRef.current = false;
          setRemindersOnState(false);
          return saveRemindersEnabled(false);
        }
        return undefined;
      });
    });
  }, []);

  const setCareRemindersOn = useCallback((enabled: boolean) => {
    careRef.current = enabled;
    setCareRemindersOnState(enabled);
    void saveCareRemindersEnabled(enabled).then(() => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      void syncReminder(current, remindersRef.current, Date.now(), {
        enabled,
        basicTreats: treatCountRef.current,
      });
    });
  }, []);

  const setCareTreatCount = useCallback((count: number) => {
    treatCountRef.current = count;
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

  const applyActorEnergy = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const next = applyEnergyDelta(current, delta);
      if (next !== current) {
        publish(next);
      }
    },
    [publish],
  );

  const applyActorHunger = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const next = applyHungerDelta(current, delta);
      if (next !== current) {
        publish(next);
      }
    },
    [publish],
  );

  const applyActorHydration = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const next = applyHydrationDelta(current, delta);
      if (next !== current) {
        publish(next);
      }
    },
    [publish],
  );

  const applyActorHappiness = useCallback(
    (delta: number) => {
      const current = stateRef.current;
      if (!current) {
        return false;
      }
      const next = applyHappinessDelta(current, delta);
      if (next === current) {
        return false;
      }
      publish(next);
      return true;
    },
    [publish],
  );

  const idle = useCallback(() => dispatch({ type: 'idle' }), [dispatch]);
  const sit = useCallback(() => dispatch({ type: 'trickRep', trackId: 'sit', now: Date.now() }), [dispatch]);
  const givePaw = useCallback(() => dispatch({ type: 'trickRep', trackId: 'paw', now: Date.now() }), [dispatch]);
  const speak = useCallback(() => dispatch({ type: 'trickRep', trackId: 'speak', now: Date.now() }), [dispatch]);
  const attemptTrick = useCallback(
    (trackId: string) => {
      const current = stateRef.current;
      if (!current) {
        return null;
      }
      const result = applyEvent(current, { type: 'trickRep', trackId, now: Date.now() });
      publish(result.state, result.cue);
      const track = result.state.training[trackId];
      return {
        ok: result.cue.kind !== 'confused' && result.cue.kind !== 'none',
        mastered: track?.mastered === true && result.state.care.pendingReward == null,
        confused: result.cue.kind === 'confused',
      };
    },
    [publish],
  );
  const resolveTraining = useCallback(
    (choice: 'treat' | 'none') => {
      const current = stateRef.current;
      if (!current?.care.pendingReward) {
        return null;
      }
      const beforeHappiness = current.needs.happiness;
      let next = current;
      if (choice === 'treat') {
        const paid = applyRewardTreat(current, 'biscuit', Date.now());
        if (!paid.ok) {
          return null;
        }
        next = paid.state;
      }
      const resolved = applyEvent(next, { type: 'rewardTreat', choice, now: Date.now() });
      const moodGain = Math.round(resolved.state.needs.happiness - beforeHappiness);
      publish(
        resolved.state,
        choice === 'treat' ? { kind: 'treat', treatId: 'biscuit', moodGain } : undefined,
      );
      return { before: current, after: resolved.state };
    },
    [publish],
  );
  const offerTreat = useCallback(
    (treatId: string) => {
      const current = stateRef.current;
      if (!current) {
        return { ok: false as const, reason: 'unknown' as const };
      }
      const before = current.needs.happiness;
      const given = giveTreat(current, treatId, Date.now());
      if (!given.ok) {
        return given;
      }
      publish(given.state, {
        kind: 'treat',
        treatId,
        moodGain: Math.round(given.state.needs.happiness - before),
      });
      return { ok: true as const, mood: Math.round(given.state.needs.happiness - before) };
    },
    [publish],
  );
  const seeCoach = useCallback((id: string) => dispatch({ type: 'seeCoach', id }), [dispatch]);
  const moveFurniture = useCallback(
    (pieceId: string, sceneId: string, x: number, y: number) => dispatch({ type: 'moveFurniture', pieceId, sceneId, x, y }),
    [dispatch],
  );
  const clearTreats = useCallback(() => dispatch({ type: 'clearTreats' }), [dispatch]);
  const dismissWelcome = useCallback(() => setWelcomeBack(false), []);
  const feed = useCallback(() => dispatch({ type: 'feed' }), [dispatch]);
  const refillWater = useCallback(() => dispatch({ type: 'refillWater' }), [dispatch]);
  const reportAte = useCallback(() => dispatch({ type: 'ate', now: Date.now() }), [dispatch]);
  const reportDrank = useCallback(
    (fromBowl: boolean) => dispatch({ type: 'drank', fromBowl, now: Date.now() }),
    [dispatch],
  );
  const rest = useCallback(() => dispatch({ type: 'toggleRest' }), [dispatch]);
  const pet = useCallback(() => dispatch({ type: 'pet' }), [dispatch]);

  const rememberGreeting = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (!current || current.lastGreetingId === id) {
        return;
      }
      publish({ ...current, lastGreetingId: id });
    },
    [publish],
  );
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

  const finishPlaydate = useCallback(
    (happiness: number, attributes: Partial<Record<Trait, number>>) => {
      dispatch({ type: 'playdate', happiness, attributes });
    },
    [dispatch],
  );

  return {
    ready,
    state,
    mood: state ? deriveMood(state) : null,
    cue,
    remindersOn,
    setRemindersOn,
    careRemindersOn,
    setCareRemindersOn,
    setCareTreatCount,
    idle,
    sit,
    givePaw,
    speak,
    feed,
    refillWater,
    reportDrank,
    reportAte,
    rest,
    pet,
    rememberGreeting,
    startCuddle,
    finishCuddle,
    fetchBall,
    throwAt,
    flickAt,
    setScene,
    equip,
    applyActorWeight,
    applyActorEnergy,
    applyActorHunger,
    applyActorHydration,
    applyActorHappiness,
    advanceBy,
    setAge,
    setVitalityValue,
    setWeightValue,
    reset,
    release,
    finishPlaydate,
    adopt,
    setOwnerId,
    attemptTrick,
    resolveTraining,
    seeCoach,
    moveFurniture,
    clearTreats,
    offerTreat,
    welcomeBack,
    dismissWelcome,
  };
}
