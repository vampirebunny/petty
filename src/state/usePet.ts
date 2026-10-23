import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { flickToThrow } from '../input/flick';
import { cancelReminders, syncReminder } from '../reminders/notifications';
import { AWAY_DECAY } from '../sim/awayDecayConfig';
import { awayElapsedHours } from '../sim/awayDecay';
import { applyRewardTreat } from '../treats/rules';
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
import { createUuid } from '../compliance/identity';
import { bootstrapLocal, wipeLocalData } from '../db/bootstrap';
import { grantSpeciesHome, grantToyOnce, moveOwnedPiece } from '../db/playerHome';
import { speciesOf } from '../sim/tracks';
import { sqlitePetStorage } from '../db/sqlitePetStorage';
import { getDb } from '../db/database';
import { catalogItem } from '../economy/catalog';
import { resumeLimitedPurchases } from '../economy/limited';
import type { PlayFindKind } from '../economy/economyConfig';
import {
  claimDailyLogin,
  onAppOpen,
  payoutTimeAccrual,
  settleProgress,
  type Burst,
  type OpenRewards,
} from '../economy/service';
import { queueCoupled, queuePet, queuePlayer, queueRetire, kick } from '../sync/queue';
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
  beginRest: () => void;
  pet: () => void;
  startCuddle: () => void;
  finishCuddle: (seconds: number) => void;
  fetchBall: () => void;
  chooseToy: (id: string, action: 'throw' | 'hold' | 'clear' | 'clearHeld') => void;
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
  retire: () => void;
  attemptTrick: (trackId: string) => { ok: boolean; mastered: boolean; confused: boolean } | null;
  resolveTraining: (choice: 'treat' | 'none', applied?: PetState) => { before: PetState; after: PetState } | null;
  seeCoach: (id: string) => void;
  moveFurniture: (pieceId: string, sceneId: string, x: number, y: number) => void;
  rememberGreeting: (id: string) => void;
  offerTreat: (treatId: string, applied?: PetState) => { ok: true; mood: number } | { ok: false; reason: 'unknown' | 'full' | 'species' };
  welcomeBack: boolean;
  dismissWelcome: () => void;
  homeSnapToken: number;
  finishPlaydate: (happiness: number, attributes: Partial<Record<Trait, number>>, playdateId?: string) => void;
  adopt: (breedId: string, attributes: PetAttributes, look: Look, name: string, ownerId: string) => void;
  setOwnerId: (ownerId: string) => void;
  commitPet: (pet: PetState, cueKind?: Cue['kind']) => void;
  noteFind: (kind: PlayFindKind, at?: { x: number; y: number }) => void;
  burst: Burst | null;
  pendingBoops: number;
  dismissBurst: () => void;
  cancelBursts: () => void;
};

export function usePet(storage: PetStorage = sqlitePetStorage): PetApi {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PetState | null>(null);
  const [cue, setCue] = useState<PetCue>({ kind: 'none', token: 0 });
  const [remindersOn, setRemindersOnState] = useState(true);
  const [careRemindersOn, setCareRemindersOnState] = useState(false);
  const careRef = useRef(false);
  const treatCountRef = useRef(0);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [homeSnapToken, setHomeSnapToken] = useState(0);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [pendingBoops, setPendingBoops] = useState(0);
  const burstRef = useRef<Burst | null>(null);
  const burstQueue = useRef<Burst[]>([]);
  const burstSeq = useRef(0);
  const greetAfter = useRef<{ elapsedH: number } | null>(null);
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

  const publish = useCallback((next: PetState, nextCue?: Cue, sync = true) => {
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
      })
      .then(() => {
        if (sync) {
          queuePet(snapshot);
        }
      });
  }, []);

  const stamp = useCallback((item: Burst): Burst => {
    burstSeq.current += 1;
    return { ...item, id: burstSeq.current };
  }, []);

  const showBursts = useCallback((head: Burst | null) => {
    burstRef.current = head;
    const waiting = burstQueue.current.reduce((sum, item) => sum + item.amount, head?.amount ?? 0);
    setBurst(head);
    setPendingBoops(waiting);
  }, []);

  const pushBurst = useCallback((item: Burst) => {
    if (item.amount <= 0) {
      return;
    }
    const tagged = stamp(item);
    const head = burstRef.current;
    if (head) {
      burstQueue.current.push(tagged);
      showBursts(head);
      return;
    }
    showBursts(tagged);
  }, [showBursts, stamp]);

  const enqueueOpen = useCallback((rewards: OpenRewards): boolean => {
    const bursts = rewards.bursts.filter((item) => item.amount > 0);
    if (rewards.login.claimable) {
      const claimed = claimDailyLogin();
      if (claimed.ok && claimed.amount && claimed.amount > 0) {
        bursts.push({
          label: `Day ${claimed.streakDay ?? rewards.login.streakDay}`,
          amount: claimed.amount,
          coinCount: 5,
        });
      }
    }
    if (bursts.length === 0) {
      return false;
    }
    const tagged = bursts.map(stamp);
    const head = burstRef.current;
    if (head) {
      burstQueue.current.push(...tagged);
      showBursts(head);
    } else {
      burstQueue.current.push(...tagged.slice(1));
      showBursts(tagged[0]);
    }
    return true;
  }, [showBursts, stamp]);

  const afterPayouts = useCallback(() => {
    const greet = greetAfter.current;
    if (!greet) {
      return;
    }
    greetAfter.current = null;
    const current = stateRef.current;
    if (current) {
      publish(current, { kind: 'greet', elapsedH: greet.elapsedH });
    }
  }, [publish]);

  const dismissBurst = useCallback(() => {
    const next = burstQueue.current.shift() ?? null;
    showBursts(next);
    if (!next) {
      afterPayouts();
    }
  }, [afterPayouts, showBursts]);

  const cancelBursts = useCallback(() => {
    burstQueue.current = [];
    showBursts(null);
    afterPayouts();
  }, [afterPayouts, showBursts]);

  const settleReturn = useCallback(
    (current: PetState, now: number) => {
      if (returningRef.current) {
        return;
      }
      returningRef.current = true;
      try {
        const opened = onAppOpen(current, now);
        const elapsedH = awayElapsedHours(opened.pet.lastUpdatedAt, now);
        const resumed = resume(opened.pet, now);
        if (resumed.sceneId !== opened.pet.sceneId) {
          setHomeSnapToken((token) => token + 1);
        }
        const settled = settleProgress(resumed, now);
        const bursts = [...opened.bursts];
        if (settled.boops > 0 && settled.label) {
          bursts.push({ label: settled.label, amount: settled.boops, coinCount: 5 });
        }
        if (elapsedH >= AWAY_DECAY.welcomeBackThresholdH) {
          setWelcomeBack(true);
        }
        const awayMin = elapsedH * 60;
        const greet = awayMin >= 2;
        const playing = enqueueOpen({ ...opened, pet: settled.pet, bursts });
        if (playing && greet) {
          greetAfter.current = { elapsedH };
          publish(settled.pet);
        } else if (greet) {
          publish(settled.pet, { kind: 'greet', elapsedH });
        } else {
          publish(settled.pet);
        }
      } finally {
        returningRef.current = false;
      }
    },
    [enqueueOpen, publish],
  );

  useEffect(() => {
    let cancelled = false;
    void bootstrapLocal()
      .then(() => Promise.all([storage.load(), loadRemindersEnabled(), loadCareRemindersEnabled()]))
      .then(([loaded, reminders, care]) => {
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
        void resumeLimitedPurchases().then((result) => {
          if (cancelled) {
            return;
          }
          const current = stateRef.current;
          if (result.unequipCrown && current?.equipped.hat === 'crown') {
            const equipped = { ...current.equipped };
            delete equipped.hat;
            publish({ ...current, equipped });
          }
          if (result.lost) {
            Alert.alert(
              'Golden Crown',
              'Sorry, the last one sold just before your purchase went through. Your Boops have been returned.',
            );
          }
        });
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
      publish(tickForeground(current, Date.now()), undefined, false);
      const paid = payoutTimeAccrual('live');
      if (paid > 0) {
        pushBurst({ label: 'Boops', amount: paid, coinCount: 1 });
      }
    }, openTickMs);
    return () => clearInterval(timer);
  }, [publish, pushBurst]);

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
        payoutTimeAccrual('live', now);
        const resolved = current.care.pendingReward ? resolveReward(current, now, 'none') : current;
        publish({ ...resolved, lastUpdatedAt: now, weightAppliedAt: now });
        kick(true);
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

  const commitProgress = useCallback(
    (event: PetEvent, extra?: { playdateId?: string; find?: PlayFindKind }) => {
      const current = stateRef.current;
      if (!current) {
        return null;
      }
      const result = applyEvent(current, event);
      const settled = settleProgress(result.state, Date.now(), extra);
      if (settled.boops > 0 && settled.label) {
        pushBurst({ label: settled.label, amount: settled.boops, coinCount: extra?.find ? 1 : 5 });
      }
      publish(settled.pet, result.cue);
      return { ...result, state: settled.pet };
    },
    [publish, pushBurst],
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
      const aged = stateRef.current;
      if (aged) {
        const settled = settleProgress(aged, Date.now());
        if (settled.boops > 0 && settled.label) {
          pushBurst({ label: settled.label, amount: settled.boops, coinCount: 5 });
        }
        if (settled.pet !== aged) {
          publish(settled.pet);
        }
      }
    },
    [publish, pushBurst],
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
    stateRef.current = null;
    setState(null);
    tokenRef.current += 1;
    setCue({ kind: 'none', token: tokenRef.current });
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => wipeLocalData())
      .then(() => cancelReminders())
      .catch(() => undefined);
  }, []);

  const retire = useCallback(() => {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    const frozen: PetState = { ...current, equipped: {}, retiredAt: Date.now() };
    const draftCleared = clearDraft();
    stateRef.current = null;
    setState(null);
    tokenRef.current += 1;
    setCue({ kind: 'none', token: tokenRef.current });
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => draftCleared)
      .then(() => cancelReminders())
      .then(() => {
        const database = getDb();
        database.runSync(
          'INSERT OR REPLACE INTO retired_pets (id, json, retired_at) VALUES (?, ?, ?)',
          frozen.id,
          JSON.stringify(frozen),
          frozen.retiredAt ?? Date.now(),
        );
        database.runSync('DELETE FROM pet');
        queueRetire(frozen);
      })
      .catch(() => undefined);
  }, []);

  const adopt = useCallback(
    (breedId: string, attributes: PetAttributes, look: Look, name: string, ownerId: string) => {
      const now = Date.now();
      const id = createUuid();
      grantToyOnce(ownerId);
      grantSpeciesHome(ownerId, speciesOf(breedId));
      const created = createPet({ id, ownerId, name, breedId, look, attributes, now });
      const opened = onAppOpen(created, now);
      enqueueOpen(opened);
      publish(opened.pet, { kind: 'none' });
      void clearDraft();
    },
    [enqueueOpen, publish],
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
  const sit = useCallback(() => commitProgress({ type: 'trickRep', trackId: 'sit', now: Date.now() }), [commitProgress]);
  const givePaw = useCallback(() => commitProgress({ type: 'trickRep', trackId: 'paw', now: Date.now() }), [commitProgress]);
  const speak = useCallback(() => commitProgress({ type: 'trickRep', trackId: 'speak', now: Date.now() }), [commitProgress]);
  const attemptTrick = useCallback(
    (trackId: string) => {
      const result = commitProgress({ type: 'trickRep', trackId, now: Date.now() });
      if (!result) {
        return null;
      }
      const track = result.state.training[trackId];
      return {
        ok: result.cue.kind !== 'confused' && result.cue.kind !== 'none',
        mastered: track?.mastered === true && result.state.care.pendingReward == null,
        confused: result.cue.kind === 'confused',
      };
    },
    [commitProgress],
  );
  const resolveTraining = useCallback(
    (choice: 'treat' | 'none', applied?: PetState) => {
      const current = stateRef.current;
      const base = applied ?? current;
      if (!current || !base?.care.pendingReward) {
        return null;
      }
      const beforeHappiness = current.needs.happiness;
      let next = base;
      if (choice === 'treat' && !applied) {
        const paid = applyRewardTreat(base, 'biscuit', Date.now());
        if (!paid.ok) {
          return null;
        }
        next = paid.state;
      }
      const resolved = applyEvent(next, { type: 'rewardTreat', choice, now: Date.now() });
      const settled = settleProgress(resolved.state, Date.now());
      if (settled.boops > 0 && settled.label) {
        pushBurst({ label: settled.label, amount: settled.boops, coinCount: 5 });
      }
      const moodGain = Math.round(settled.pet.needs.happiness - beforeHappiness);
      publish(settled.pet, choice === 'treat' ? { kind: 'treat', treatId: 'biscuit', moodGain } : undefined);
      return { before: current, after: settled.pet };
    },
    [publish, pushBurst],
  );
  const offerTreat = useCallback(
    (treatId: string, applied?: PetState) => {
      const current = stateRef.current;
      if (!current || !applied) {
        return { ok: false as const, reason: 'unknown' as const };
      }
      const before = current.needs.happiness;
      const mood = Math.round(applied.needs.happiness - before);
      publish(applied, { kind: 'treat', treatId, moodGain: mood });
      return { ok: true as const, mood };
    },
    [publish],
  );
  const seeCoach = useCallback((id: string) => dispatch({ type: 'seeCoach', id }), [dispatch]);
  const moveFurniture = useCallback((pieceId: string, sceneId: string, x: number, y: number) => {
    const current = stateRef.current;
    const ownerId = current?.ownerId;
    if (!current || !ownerId) {
      return;
    }
    moveOwnedPiece(ownerId, speciesOf(current.breedId), pieceId, sceneId, x, y);
    queuePlayer();
  }, []);
  const dismissWelcome = useCallback(() => setWelcomeBack(false), []);
  const feed = useCallback(() => dispatch({ type: 'feed' }), [dispatch]);
  const refillWater = useCallback(() => dispatch({ type: 'refillWater' }), [dispatch]);
  const reportAte = useCallback(() => {
    const current = stateRef.current;
    const item = current?.bowlItemId ? catalogItem(current.bowlItemId) : null;
    const multipliers = item?.effects?.mealMultipliers;
    const meal = item?.effects?.premiumMeal
      ? { hunger: 1, weight: 1, energy: 1, xp: 1, mood: 0, diet: 0.25, fillTummy: true }
      : multipliers
        ? { ...multipliers, mood: item?.effects?.moodBonus ?? 0 }
        : undefined;
    commitProgress({ type: 'ate', now: Date.now(), meal });
  }, [commitProgress]);
  const reportDrank = useCallback(
    (fromBowl: boolean) => dispatch({ type: 'drank', fromBowl, now: Date.now() }),
    [dispatch],
  );
  const rest = useCallback(() => dispatch({ type: 'toggleRest' }), [dispatch]);
  const beginRest = useCallback(() => dispatch({ type: 'beginRest' }), [dispatch]);
  const pet = useCallback(() => commitProgress({ type: 'pet' }), [commitProgress]);

  const rememberGreeting = useCallback(
    (id: string) => {
      const current = stateRef.current;
      if (current && current.lastGreetingId !== id) {
        publish({ ...current, lastGreetingId: id });
      }
    },
    [publish],
  );
  const startCuddle = useCallback(() => dispatch({ type: 'cuddleStart' }), [dispatch]);
  const finishCuddle = useCallback(
    (seconds: number) => commitProgress({ type: 'cuddled', seconds }, seconds > 0 ? { find: 'cuddle_session' } : undefined),
    [commitProgress],
  );
  const fetchBall = useCallback(() => dispatch({ type: 'fetch' }), [dispatch]);
  const chooseToy = useCallback(
    (id: string, action: 'throw' | 'hold' | 'clear' | 'clearHeld') => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      if (action === 'clear' || action === 'clearHeld') {
        const active = current.activeToyId;
        const drop = action === 'clearHeld' ? active === 'wand' || active === 'laser' : active === id;
        if (drop && active) {
          publish({ ...current, activeToyId: undefined });
        }
        return;
      }
      if (!id) {
        return;
      }
      const base = { ...current, activeToyId: id, asleep: false };
      if (action === 'hold') {
        if (base.activeToyId !== current.activeToyId || base.asleep !== current.asleep) {
          publish(base);
        }
        return;
      }
      const result = applyEvent(base, { type: 'fetch' });
      publish(result.state, result.cue);
    },
    [publish],
  );
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
    (happiness: number, attributes: Partial<Record<Trait, number>>, playdateId?: string) => {
      commitProgress({ type: 'playdate', happiness, attributes }, playdateId ? { playdateId } : undefined);
    },
    [commitProgress],
  );

  const commitPet = useCallback(
    (petState: PetState, cueKind?: Cue['kind']) => {
      publish(petState, cueKind ? { kind: cueKind } : undefined);
    },
    [publish],
  );

  const noteFind = useCallback(
    (kind: PlayFindKind, at?: { x: number; y: number }) => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const settled = settleProgress(current, Date.now(), { find: kind });
      if (settled.boops > 0 && settled.label) {
        pushBurst({ label: settled.label, amount: settled.boops, coinCount: 1, origin: at });
      }
      publish(settled.pet);
    },
    [publish, pushBurst],
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
    beginRest,
    pet,
    rememberGreeting,
    startCuddle,
    finishCuddle,
    fetchBall,
    chooseToy,
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
    retire,
    finishPlaydate,
    adopt,
    setOwnerId,
    attemptTrick,
    resolveTraining,
    seeCoach,
    moveFurniture,
    offerTreat,
    welcomeBack,
    dismissWelcome,
    homeSnapToken,
    commitPet,
    noteFind,
    burst,
    pendingBoops,
    dismissBurst,
    cancelBursts,
  };
}
