import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Network from 'expo-network';

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
  chooseReward,
  resolveReward,
  resume,
  setAgeDays,
  setVitality,
  setWeight,
  tickForeground,
} from '../sim';
import type { Cue, Look, Mood, OutfitSlot, PetAttributes, PetEvent, PetState, Trait } from '../sim';
import { noteForegroundDay } from '../compliance/accountPrompts';
import { createUuid, getCachedInstallId } from '../compliance/identity';
import { bootstrapLocal, wipeLocalData } from '../db/bootstrap';
import { readAccountLinked, readStandby, readSyncedRevision, serverNow, setOtherDeviceLabel, setStandby } from '../db/accountMeta';
import { currentOwner } from '../db/currentOwner';
import { grantSpeciesHome, moveOwnedPiece, stowOwnedPiece } from '../db/playerHome';
import { claimDevice, enterStandby, hasUnsentPlay, peekActiveDevice, refreshServerTime, touchLastSeen, type ClaimResult } from '../sync/activeDevice';
import { devicePhrase } from '../sync/deviceLabel';
import { reconcileFromServer } from '../sync/reconcile';
import {
  authTransition,
  consumeInstalledSettle,
  finishInstalledPet,
  onInstallState,
  openPathSuppressed,
  saveGeneration,
  setAuthTransition,
  setLockedSettle,
  setPlayHereRequest,
  setSettleRequest,
} from './sessionGate';
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
import { queuePet, queuePlayer, queueRetire, kick } from '../sync/queue';
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
  resolveTraining: (
    choice: 'treat' | 'none',
    applied?: PetState,
    waitForBite?: boolean,
  ) => { before: PetState; after: PetState; waiting: boolean } | null;
  seeCoach: (id: string) => void;
  moveFurniture: (pieceId: string, sceneId: string, x: number, y: number) => boolean;
  stowFurniture: (pieceId: string) => void;
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

function caughtUpCopy(discarded: boolean, petName: string): string {
  if (!discarded) {
    return 'All caught up from your other device!';
  }
  return `You played on your other device more recently, so ${petName} is just how you left them there. Anything you bought here is safe.`;
}

function petNameFromDb(fallback: string): string {
  const row = getDb().getFirstSync<{ json: string }>('SELECT json FROM pet LIMIT 1');
  if (!row) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(row.json) as { name?: string };
    return parsed.name || fallback;
  } catch {
    return fallback;
  }
}

async function linkedChangeIsCurrent(title: string, petName: string): Promise<boolean> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) {
    Alert.alert(title, "You'll need internet to do this.");
    return false;
  }
  const claim = await claimDevice({ timeoutMs: 3000 });
  if (!claim) {
    Alert.alert(title, "You'll need internet to do this.");
    return false;
  }
  const install = getCachedInstallId();
  const other = Boolean(claim.active_device_id_before && claim.active_device_id_before !== install);
  const newer = claim.server_revision > readSyncedRevision();
  if (!other && !newer) {
    return true;
  }
  const discarded = hasUnsentPlay();
  const ok = await reconcileFromServer(claim);
  if (other && ok) {
    Alert.alert('Caught up', caughtUpCopy(discarded, petNameFromDb(petName)));
  }
  return false;
}

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
  const statusRef = useRef(AppState.currentState);
  const considerOpenRef = useRef<(pet: PetState) => void>(() => undefined);
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
    const generation = saveGeneration();
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => {
        if (saveGeneration() !== generation) {
          return undefined;
        }
        return storageRef.current.save(snapshot);
      })
      .then(() => {
        if (saveGeneration() !== generation || readStandby()) {
          return true;
        }
        return syncReminder(snapshot, remindersRef.current, Date.now(), {
          enabled: careRef.current,
          basicTreats: treatCountRef.current,
        });
      })
      .then((allowed) => {
        if (remindersRef.current && !allowed) {
          remindersRef.current = false;
          setRemindersOnState(false);
          return saveRemindersEnabled(false);
        }
        return undefined;
      })
      .then(() => {
        if (sync && saveGeneration() === generation && authTransition() === 'idle') {
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
    noteForegroundDay();
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
        considerOpenRef.current(loaded);
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
  }, [publish, settleReturn, storage]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current || !activeRef.current || authTransition() !== 'idle' || readStandby()) {
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

  const finishClaim = useCallback(
    async (current: PetState, claim: ClaimResult, fromStandby: boolean) => {
      const install = getCachedInstallId();
      const other = Boolean(claim.active_device_id_before && claim.active_device_id_before !== install);
      const newer = claim.server_revision > readSyncedRevision();
      const discarded = hasUnsentPlay();
      try {
        if (other || newer) {
          const ok = await reconcileFromServer(claim);
          if (!ok) {
            if (!readStandby()) {
              settleReturn(stateRef.current ?? current, serverNow());
            }
            return;
          }
        }
        if (fromStandby) {
          setStandby(false);
        }
        const pet = stateRef.current ?? current;
        settleReturn(pet, serverNow());
        const settled = stateRef.current ?? pet;
        void syncReminder(settled, remindersRef.current, Date.now(), {
          enabled: careRef.current,
          basicTreats: treatCountRef.current,
        });
        if (other) {
          Alert.alert('Caught up', caughtUpCopy(discarded, petNameFromDb(settled.name)));
        }
      } finally {
        if (authTransition() === 'reconciling') {
          setAuthTransition('idle');
        }
      }
    },
    [settleReturn],
  );

  const claimBusy = useRef(false);
  const takeSlot = useCallback(
    (current: PetState, fromStandby: boolean) => {
      if (claimBusy.current || authTransition() !== 'idle') {
        return;
      }
      claimBusy.current = true;
      setAuthTransition('reconciling');
      const claimId = createUuid();
      void (async () => {
        try {
          const claim = await claimDevice({ claimId, timeoutMs: 3000 });
          if (!claim) {
            setAuthTransition('idle');
            if (fromStandby) {
              Alert.alert('Play here', "You'll need internet to play here.");
            } else {
              settleReturn(current, serverNow());
            }
            const retried = await claimDevice({ claimId, timeoutMs: 3000 });
            if (!retried || authTransition() !== 'idle') {
              return;
            }
            if (fromStandby ? !readStandby() : readStandby()) {
              return;
            }
            setAuthTransition('reconciling');
            await finishClaim(stateRef.current ?? current, retried, fromStandby);
            return;
          }
          await finishClaim(current, claim, fromStandby);
        } finally {
          claimBusy.current = false;
        }
      })();
    },
    [finishClaim, settleReturn],
  );

  const considerOpen = useCallback(
    (current: PetState) => {
      if (openPathSuppressed() || authTransition() !== 'idle' || readStandby()) {
        return;
      }
      if (!readAccountLinked()) {
        void (async () => {
          const net = await Network.getNetworkStateAsync();
          if (net.isConnected) {
            await refreshServerTime();
          }
          settleReturn(current, Date.now());
        })();
        return;
      }
      void (async () => {
        const net = await Network.getNetworkStateAsync();
        if (!net.isConnected) {
          settleReturn(current, serverNow());
          return;
        }
        const peek = await peekActiveDevice();
        const install = getCachedInstallId();
        if (peek?.active_device_id && peek.active_device_id !== install) {
          setOtherDeviceLabel(peek.active_device_label);
          const phrase = devicePhrase(peek.active_device_label);
          const message = hasUnsentPlay()
            ? `You're playing on ${phrase}. Play on this device since then will be replaced. Anything you bought here is safe. If you tap Not now, that play stays on this device until you tap Play here, which replaces it the same way.`
            : `You're playing on ${phrase}. Continue here?`;
          Alert.alert('Continue here?', message, [
            { text: 'Not now', onPress: () => void enterStandby(false) },
            { text: 'Continue here', onPress: () => takeSlot(current, false) },
          ]);
          return;
        }
        takeSlot(current, false);
      })();
    },
    [settleReturn, takeSlot],
  );

  useEffect(() => {
    considerOpenRef.current = considerOpen;
  }, [considerOpen]);

  useEffect(() => {
    return onInstallState(() => {
      void storageRef.current.load().then((loaded) => {
        const settling = consumeInstalledSettle();
        try {
          if (!loaded) {
            if (settling) {
              stateRef.current = null;
              setState(null);
            }
            return;
          }
          stateRef.current = loaded;
          setState(loaded);
          if (!readStandby()) {
            void syncReminder(loaded, remindersRef.current, Date.now(), {
              enabled: careRef.current,
              basicTreats: treatCountRef.current,
            });
          }
          if (settling) {
            settleReturn(loaded, serverNow());
          }
        } finally {
          if (settling) {
            finishInstalledPet();
          }
        }
      });
    });
  }, [settleReturn]);

  useEffect(() => {
    setSettleRequest(() => {
      const current = stateRef.current;
      if (current && authTransition() === 'idle') {
        settleReturn(current, serverNow());
      }
    });
    return () => setSettleRequest(null);
  }, [settleReturn]);

  useEffect(() => {
    setPlayHereRequest(() => {
      const current = stateRef.current;
      if (!current) {
        return;
      }
      void (async () => {
        const net = await Network.getNetworkStateAsync();
        if (!net.isConnected) {
          Alert.alert('Play here', "You'll need internet to play here.");
          return;
        }
        takeSlot(current, true);
      })();
    });
    return () => setPlayHereRequest(null);
  }, [takeSlot]);

  useEffect(() => {
    setLockedSettle(() => {
      const current = stateRef.current;
      if (current) {
        settleReturn(current, serverNow());
      }
    });
    return () => setLockedSettle(null);
  }, [settleReturn]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      const previous = statusRef.current;
      statusRef.current = status;
      activeRef.current = status === 'active';
      if (status === 'active') {
        noteForegroundDay();
      }
      const current = stateRef.current;
      if (!current) {
        return;
      }
      const now = Date.now();
      if (previous === 'active' && status === 'background') {
        payoutTimeAccrual('live');
        const resolved = current.care.pendingReward ? resolveReward(current, now, 'none') : current;
        publish({ ...resolved, lastUpdatedAt: now, weightAppliedAt: now });
        void touchLastSeen();
        kick(true);
        return;
      }
      if (status === 'active' && previous === 'background') {
        considerOpen(current);
      }
    });
    return () => subscription.remove();
  }, [considerOpen, publish]);

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

  const retireNow = useCallback((current: PetState) => {
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

  const retire = useCallback(() => {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    void (async () => {
      if (readAccountLinked() && !(await linkedChangeIsCurrent('Goodbye', current.name))) {
        return;
      }
      retireNow(current);
    })();
  }, [retireNow]);

  const adopt = useCallback(
    (breedId: string, attributes: PetAttributes, look: Look, name: string, ownerId: string) => {
      void (async () => {
        if (readAccountLinked() && !(await linkedChangeIsCurrent('Adoption', name))) {
          return;
        }
        const now = Date.now();
        const id = createUuid();
        grantSpeciesHome(ownerId, speciesOf(breedId));
        const created = createPet({ id, ownerId, name, breedId, look, attributes, now });
        const opened = onAppOpen(created, now);
        enqueueOpen(opened);
        publish(opened.pet, { kind: 'none' });
        void clearDraft();
      })();
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
      }, true).then((allowed) => {
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
      const catalogTrick = trackId !== 'sit' && trackId !== 'paw' && trackId !== 'speak';
      if (catalogTrick) {
        const pending = result.state.care.pendingReward != null;
        return {
          ok: pending,
          mastered: track?.mastered === true && !pending,
          confused: track != null && !track.mastered && !pending,
        };
      }
      return {
        ok: result.cue.kind !== 'confused' && result.cue.kind !== 'none',
        mastered: track?.mastered === true && result.state.care.pendingReward == null,
        confused: result.cue.kind === 'confused',
      };
    },
    [commitProgress],
  );
  const resolveTraining = useCallback(
    (choice: 'treat' | 'none', applied?: PetState, waitForBite = false) => {
      const current = stateRef.current;
      const base = applied ?? current;
      if (!current || !base?.care.pendingReward) {
        return null;
      }
      const beforeHappiness = current.needs.happiness;
      const alreadyWaiting = base.care.pendingReward.choice === 'treat';
      let next = base;
      if (choice === 'treat' && !applied && !alreadyWaiting) {
        const paid = applyRewardTreat(base, 'biscuit', Date.now());
        if (!paid.ok) {
          return null;
        }
        next = paid.state;
      }
      if (choice === 'treat' && waitForBite && !alreadyWaiting) {
        const held = chooseReward(next, 'treat');
        const moodGain = Math.round(held.needs.happiness - beforeHappiness);
        publish(held, { kind: 'treat', treatId: 'biscuit', moodGain });
        return { before: current, after: held, waiting: true };
      }
      const picked = next.care.pendingReward?.choice ?? choice;
      const resolved = applyEvent(next, { type: 'rewardTreat', choice: picked, now: Date.now() });
      const settled = settleProgress(resolved.state, Date.now());
      if (settled.boops > 0 && settled.label) {
        pushBurst({ label: settled.label, amount: settled.boops, coinCount: 5 });
      }
      const moodGain = Math.round(settled.pet.needs.happiness - beforeHappiness);
      const showTreat = choice === 'treat' && !alreadyWaiting;
      publish(settled.pet, showTreat ? { kind: 'treat', treatId: 'biscuit', moodGain } : undefined);
      return { before: current, after: settled.pet, waiting: false };
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
    if (!current) {
      return false;
    }
    const saved = moveOwnedPiece(currentOwner(), speciesOf(current.breedId), pieceId, sceneId, x, y);
    if (saved) {
      queuePlayer();
    }
    return saved;
  }, []);
  const stowFurniture = useCallback((pieceId: string) => {
    const current = stateRef.current;
    if (!current) {
      return;
    }
    stowOwnedPiece(currentOwner(), speciesOf(current.breedId), pieceId);
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
    stowFurniture,
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
