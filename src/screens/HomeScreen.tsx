import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, Pressable, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  actionReason,
  breedById,
  sceneById,
  sceneList,
  stagePoint,
  wardrobe,
} from '../actor';
import { releaseMusic, setMusicEnabled, suspendMusic } from '../audio/music';
import { setSoundEnabled } from '../audio/voice';
import type { CuddleOut } from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
import { flickSpeedThreshold } from '../input/flick';
import { CuddleGesture } from '../input/cuddleGesture';
import type { GestureEvent } from '../input/cuddleGesture';
import { archetypeNames, archetypeStyleNames, attributeScore, currentStyle, petStrokeIntervalMs, traits } from '../sim';
import type { OutfitSlot, Trait } from '../sim';
import { loadMusicEnabled, loadSoundEnabled, saveMusicEnabled, saveSoundEnabled } from '../storage/session';
import { usePet } from '../state/usePet';
import { useEconomy } from '../economy/useEconomy';
import { basicTreatId, emptyEconomy, minutesUntilTreat, rewardTierAvailable, specialTreatId, stackQty } from '../economy/state';
import { messDestination, messesIn, messStage } from '../sim/messes';
import { houseTrained } from '../sim/tracks';
import {
  ghostDelayMs,
  ghostEligible,
  loadCoachSeen,
  saveCoachSeen,
  startCuddleSession,
} from '../cuddle/guidance';
import { ActionButtons } from '../ui/ActionButtons';
import type { PetAction } from '../ui/ActionButtons';
import { PlaydateScreen } from './PlaydateScreen';
import { usePlaydates } from '../state/usePlaydates';
import { formatCooldown } from '../playdate/cooldown';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedRings } from '../ui/NeedRings';
import { CareChips } from '../ui/CareChips';
import { TrainingRings } from '../ui/TrainingRings';
import { BadgeCelebration } from '../ui/BadgeCelebration';
import { playBadgeChime } from '../audio/badge';
import { PetView } from '../ui/PetView';
import { useStageSize } from '../ui/useStageSize';
import type { CuddleHandle } from '../ui/PetView';
import { CuddleFeedback } from '../ui/cuddle/CuddleFeedback';
import type { FeedbackHandle } from '../ui/cuddle/CuddleFeedback';
import { CoachMarks, CuddleHelpSheet, GhostFinger } from '../ui/cuddle/CuddleGuidance';

const badgeLabels: Record<string, string> = {
  house_training: 'Housebroken',
  sit: 'Sit',
  speak: 'Speak',
  paw: 'Paw',
};

function earnedBadges(milestones: string[], species: 'dog' | 'cat') {
  return Object.keys(badgeLabels)
    .filter((id) => milestones.includes(id) && (id !== 'paw' || species === 'dog'))
    .map((id) => ({ id, label: badgeLabels[id] }));
}

type Props = {
  petApi: ReturnType<typeof usePet>;
};

const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function HomeScreen({ petApi }: Props) {
  const {
    state,
    mood,
    cue,
    feed,
    refillWater,
    reportDrank,
    reportAte,
    sit,
    givePaw,
    speak,
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
    applyActorEnergy,
    applyActorHunger,
    advanceBy,
    setAge,
    setVitalityValue,
    setWeightValue,
    reset,
    release,
    finishPlaydate,
    goPotty,
    returnHome,
    rewardTreat,
    rewardCuddle,
    cleanMess,
    seeCoach,
    claimGrants,
    clearTreats,
    welcomeBack,
    dismissWelcome,
    careRemindersOn,
    setCareRemindersOn,
    setCareTreatCount,
  } = petApi;
  const economyApi = useEconomy(state?.ownerId);
  const [cleanOn, setCleanOn] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [treatTier, setTreatTier] = useState<'basic' | 'special'>('basic');
  const lastStrokeAt = useRef(0);
  const { viewWidth, viewHeight } = useStageSize();
  const [playdateOpen, setPlaydateOpen] = useState(false);
  const playdates = usePlaydates(state?.ownerId);
  const [hour, setHour] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [cuddleOn, setCuddleOn] = useState(false);
  const [traveling, setTraveling] = useState(false);
  const [coachVisible, setCoachVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sessionNumber, setSessionNumber] = useState(0);
  const [ghost, setGhost] = useState<{ from: { x: number; y: number }; to: { x: number; y: number }; key: number } | null>(
    null,
  );
  const [coachTarget, setCoachTarget] = useState<{ x: number; y: number } | null>(null);
  const cuddleHandle = useRef<CuddleHandle>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const tracker = useRef(new CuddleGesture());
  const touchedRef = useRef(false);
  const touchActive = useRef(false);
  const lastTrailAt = useRef(0);
  const cuddleOnRef = useRef(false);
  const [note, setNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadSoundEnabled().then((enabled) => {
      if (mounted) {
        setSoundOn(enabled);
        setSoundEnabled(enabled);
      }
    });
    void loadMusicEnabled().then((enabled) => {
      if (mounted) {
        setMusicOn(enabled);
        setMusicEnabled(enabled);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      suspendMusic(state !== 'active');
    });
    return () => {
      mounted = false;
      appState.remove();
      releaseMusic();
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
      }
    };
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    void saveSoundEnabled(next);
  }, [soundOn]);

  const toggleMusic = useCallback(() => {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
    void saveMusicEnabled(next);
  }, [musicOn]);

  const flash = useCallback((text: string) => {
    setNote(text);
    if (noteTimer.current) {
      clearTimeout(noteTimer.current);
    }
    noteTimer.current = setTimeout(() => setNote(''), 2600);
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReducedMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (cue.kind === 'wiggle' || cue.kind === 'purr') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [cue.kind, cue.token]);

  const stroke = useCallback(() => {
    const now = Date.now();
    if (now - lastStrokeAt.current < petStrokeIntervalMs) {
      return;
    }
    lastStrokeAt.current = now;
    pet();
  }, [pet]);

  const softDropHere = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight);
      if (cleanOn && state) {
        const here = messesIn(state, state.sceneId);
        const hit = here.find((mess) => Math.hypot(mess.x - point.x, mess.y - point.y) < 48);
        if (hit) {
          cleanMess(hit.id);
        }
        return;
      }
      throwAt(point.x, point.y);
    },
    [cleanMess, cleanOn, state, throwAt, viewHeight, viewWidth],
  );
  const flickHere = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight);
      const scaleX = stageWidth / Math.max(viewWidth, 1);
      const scaleY = stageHeight / Math.max(viewHeight, 1);
      flickAt(point.x, point.y, vx * scaleX, vy * scaleY);
    },
    [flickAt, viewHeight, viewWidth],
  );
  const stageToView = useCallback(
    (point: { x: number; y: number }) => ({
      x: (point.x / stageWidth) * viewWidth,
      y: (point.y / stageHeight) * viewHeight,
    }),
    [viewHeight, viewWidth],
  );

  const acceptingTouch = useCallback(() => {
    const phase = cuddleHandle.current?.phase();
    return phase === 'waiting' || phase === 'rollDown' || phase === 'rollOver' || phase === 'belly';
  }, []);

  const sendCuddleEvents = useCallback(
    (events: GestureEvent[]) => {
      const handle = cuddleHandle.current;
      if (!handle || !acceptingTouch()) {
        return;
      }
      if (events.length > 0) {
        rewardCuddle();
      }
      for (const event of events) {
        const stage = stagePoint(event.x, event.y, viewWidth, viewHeight);
        if (event.type === 'move') {
          touchedRef.current = true;
          handle.touch({ kind: 'move', zone: event.zone, x: stage.x });
          const now = Date.now();
          if (now - lastTrailAt.current > 35) {
            lastTrailAt.current = now;
            feedback.current?.trail(event.x, event.y);
          }
        } else if (event.type === 'stroke') {
          handle.touch({ kind: 'stroke', zone: event.zone, x: stage.x });
        } else if (event.type === 'heart') {
          feedback.current?.heart(event.x, event.y);
        } else if (event.type === 'tooFast') {
          touchedRef.current = true;
          handle.touch({ kind: 'flinch', zone: 'back', x: stage.x });
        } else {
          touchedRef.current = true;
          handle.touch({ kind: 'scratch', zone: event.zone, x: stage.x });
        }
      }
    },
    [acceptingTouch, rewardCuddle, viewHeight, viewWidth],
  );

  const cuddleMove = useCallback(
    (x: number, y: number) => {
      const handle = cuddleHandle.current;
      if (!handle) {
        return;
      }
      if (!touchActive.current) {
        touchActive.current = true;
        tracker.current.begin();
      }
      const stage = stagePoint(x, y, viewWidth, viewHeight);
      sendCuddleEvents(tracker.current.move(x, y, Date.now(), handle.zoneAt(stage.x, stage.y)));
    },
    [sendCuddleEvents, viewHeight, viewWidth],
  );
  const cuddleTap = useCallback(
    (x: number, y: number) => {
      const handle = cuddleHandle.current;
      if (!handle || !acceptingTouch()) {
        return;
      }
      const stage = stagePoint(x, y, viewWidth, viewHeight);
      if (handle.zoneAt(stage.x, stage.y) === 'nose') {
        touchedRef.current = true;
        rewardCuddle();
        handle.touch({ kind: 'boop', zone: 'nose', x: stage.x });
      }
    },
    [acceptingTouch, rewardCuddle, viewHeight, viewWidth],
  );
  const cuddleEnd = useCallback(() => {
    touchActive.current = false;
  }, []);
  const cuddleMoveRef = useRef(cuddleMove);
  const cuddleTapRef = useRef(cuddleTap);
  const cuddleEndRef = useRef(cuddleEnd);
  useEffect(() => {
    cuddleMoveRef.current = cuddleMove;
    cuddleTapRef.current = cuddleTap;
    cuddleEndRef.current = cuddleEnd;
  }, [cuddleEnd, cuddleMove, cuddleTap]);
  const onCuddleMoveStage = useCallback((x: number, y: number) => cuddleMoveRef.current(x, y), []);
  const onCuddleTapStage = useCallback((x: number, y: number) => cuddleTapRef.current(x, y), []);
  const onCuddleEndStage = useCallback(() => cuddleEndRef.current(), []);

  const dropRef = useRef(softDropHere);
  const flickRef = useRef(flickHere);
  const strokeRef = useRef(stroke);
  useEffect(() => {
    dropRef.current = softDropHere;
    flickRef.current = flickHere;
    strokeRef.current = stroke;
  }, [flickHere, softDropHere, stroke]);
  const onTapStage = useCallback((x: number, y: number) => {
    dropRef.current(x, y);
  }, []);
  const onStrokeStage = useCallback(() => {
    strokeRef.current();
  }, []);
  const onFlickStage = useCallback((x: number, y: number, vx: number, vy: number) => {
    flickRef.current(x, y, vx, vy);
  }, []);
  const gesture = useMemo(() => {
    if (cuddleOn) {
      // Cuddle replaces the ball gestures: a drag is a stroke or a scratch, a tap on the nose is a boop.
      const boop = Gesture.Tap()
        .maxDistance(12)
        .enabled(!coachVisible)
        .onEnd((event, success) => {
          if (success) {
            runOnJS(onCuddleTapStage)(event.x, event.y);
          }
        });
      const drag = Gesture.Pan()
        .minDistance(4)
        .enabled(!coachVisible)
        .onUpdate((event) => {
          runOnJS(onCuddleMoveStage)(event.x, event.y);
        })
        .onFinalize(() => {
          runOnJS(onCuddleEndStage)();
        });
      return Gesture.Exclusive(boop, drag);
    }
    const tap = Gesture.Tap()
      .maxDistance(18)
      .onEnd((event) => {
        runOnJS(onTapStage)(event.x, event.y);
      });
    const pan = Gesture.Pan()
      .minDistance(18)
      .onUpdate(() => {
        runOnJS(onStrokeStage)();
      })
      .onEnd((event) => {
        const speed = Math.hypot(event.velocityX, event.velocityY);
        if (speed >= flickSpeedThreshold) {
          runOnJS(onFlickStage)(event.x, event.y, event.velocityX, event.velocityY);
        }
      });
    return Gesture.Exclusive(tap, pan);
  }, [coachVisible, cuddleOn, onCuddleEndStage, onCuddleMoveStage, onCuddleTapStage, onFlickStage, onStrokeStage, onTapStage]);
  const petName = state?.name ?? 'Your pet';

  const toggleCuddle = useCallback(() => {
    if (cuddleOnRef.current) {
      cuddleOnRef.current = false;
      setCuddleOn(false);
      setCoachVisible(false);
      setGhost(null);
      return;
    }
    cuddleOnRef.current = true;
    startCuddle();
    setCuddleOn(true);
    setGhost(null);
    setSessionNumber(0);
    tracker.current.reset();
    touchedRef.current = false;
    touchActive.current = false;
    void Promise.all([loadCoachSeen(), startCuddleSession()]).then(([seen, session]) => {
      if (!cuddleOnRef.current) {
        return;
      }
      setSessionNumber(session);
      if (!seen) {
        setCoachVisible(true);
      }
    });
  }, [startCuddle]);

  const dismissCoach = useCallback(() => {
    setCoachVisible(false);
    void saveCoachSeen();
  }, []);

  const onCuddleEvent = useCallback(
    (event: CuddleOut | { type: 'interrupted' }) => {
      if (event.type === 'exit') {
        cuddleOnRef.current = false;
        setCuddleOn(false);
        setCoachVisible(false);
        setGhost(null);
        flash(
          event.reason === 'tolerance'
            ? `${petName} has had enough cuddles for now.`
            : `${petName} is done cuddling.`,
        );
      } else if (event.type === 'interrupted') {
        cuddleOnRef.current = false;
        setCuddleOn(false);
        setCoachVisible(false);
        setGhost(null);
      } else if (event.petted >= 2) {
        finishCuddle(event.petted);
      }
    },
    [finishCuddle, flash, petName],
  );

  // The ghost finger strokes the back once if a settled pet goes untouched, for the first few sessions.
  useEffect(() => {
    if (!cuddleOn || coachVisible || !ghostEligible(sessionNumber)) {
      return undefined;
    }
    let settledAt: number | null = null;
    let shown = false;
    const timer = setInterval(() => {
      if (shown || touchedRef.current) {
        return;
      }
      if (cuddleHandle.current?.phase() !== 'waiting') {
        return;
      }
      settledAt ??= Date.now();
      if (Date.now() - settledAt >= ghostDelayMs) {
        const path = cuddleHandle.current?.backPath();
        if (path) {
          shown = true;
          setGhost({ from: stageToView(path.from), to: stageToView(path.to), key: Date.now() });
        }
      }
    }, 200);
    return () => clearInterval(timer);
  }, [coachVisible, cuddleOn, sessionNumber, stageToView]);

  // Keeps the coach-mark ring on the pet while the pet settles.
  useEffect(() => {
    if (!coachVisible) {
      return undefined;
    }
    const update = () => {
      const path = cuddleHandle.current?.backPath();
      if (path) {
        setCoachTarget(stageToView({ x: (path.from.x + path.to.x) / 2, y: (path.from.y + path.to.y) / 2 }));
      }
    };
    update();
    const timer = setInterval(update, 300);
    return () => clearInterval(timer);
  }, [coachVisible, stageToView]);

  const grantedKey = useRef('');
  const migratedTreats = useRef(false);
  const wallet = economyApi.economy;
  const unclaimedBasic = state?.care.unclaimed.basic ?? 0;
  const unclaimedSpecial = state?.care.unclaimed.special ?? 0;
  const legacyTreats = state?.treats;

  useEffect(() => {
    setCareTreatCount(stackQty(wallet ?? emptyEconomy(0), basicTreatId));
  }, [setCareTreatCount, wallet]);

  useEffect(() => {
    if (!wallet || (unclaimedBasic <= 0 && unclaimedSpecial <= 0)) {
      return;
    }
    const key = `${unclaimedBasic}:${unclaimedSpecial}`;
    if (grantedKey.current === key) {
      return;
    }
    grantedKey.current = key;
    economyApi.grantMany([
      { itemId: basicTreatId, qty: unclaimedBasic },
      { itemId: specialTreatId, qty: unclaimedSpecial },
    ]);
    claimGrants();
  }, [claimGrants, economyApi, unclaimedBasic, unclaimedSpecial, wallet]);

  useEffect(() => {
    if (!wallet || !legacyTreats || legacyTreats.length === 0 || migratedTreats.current) {
      return;
    }
    migratedTreats.current = true;
    economyApi.grantMany(legacyTreats.map((stack) => ({ itemId: stack.treatId, qty: stack.count })));
    clearTreats();
  }, [clearTreats, economyApi, legacyTreats, wallet]);

  const milestones = state?.milestones;
  const [knownMilestones, setKnownMilestones] = useState<string[] | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);
  if (milestones && (knownMilestones == null || milestones.length !== knownMilestones.length)) {
    setKnownMilestones(milestones);
    if (knownMilestones != null) {
      const fresh = milestones.find((id) => !knownMilestones.includes(id) && badgeLabels[id]);
      if (fresh) {
        setCelebrating(fresh);
      }
    }
  }
  useEffect(() => {
    if (celebrating) {
      playBadgeChime();
    }
  }, [celebrating]);
  const finishCelebration = useCallback(() => setCelebrating(null), []);

  const preset = sceneById(state?.sceneId ?? 'livingroom');
  const scene = preset;

  if (!state || !mood) {
    return null;
  }

  if (playdateOpen) {
    return (
      <PlaydateScreen
        pet={state}
        save={playdates.save}
        now={playdates.now}
        remaining={playdates.remaining}
        reducedMotion={reducedMotion}
        onSave={playdates.persist}
        onRewarded={finishPlaydate}
        onClose={() => setPlaydateOpen(false)}
      />
    );
  }

  const origin = state.attributes.archetype;
  const style = currentStyle(origin, state.attributes.current, state.attributes.potential);
  const styleLine =
    style === origin
      ? archetypeNames[origin]
      : `Born: ${archetypeNames[origin]} · Style: ${archetypeStyleNames[style]}`;
  const species = breedById(state.breedId)?.species ?? 'dog';
  const ownsBall = state.toys.includes('ball');

  const actions: PetAction[] = [
    {
      id: 'cuddle',
      label: 'Cuddle',
      onPress: toggleCuddle,
      onLongPress: () => setHelpOpen(true),
      active: cuddleOn,
    },
    { id: state.asleep ? 'wake' : 'rest', label: state.asleep ? 'Wake' : 'Sleep', onPress: rest },
    {
      id: 'feed',
      label: 'Feed',
      onPress: () => {
        setPlayOpen(false);
        feed();
      },
      reason: actionReason(scene, 'feed') || (state.foodInBowl ? 'The food bowl is already full.' : ''),
    },
    {
      id: 'refill',
      label: 'Refill water',
      onPress: refillWater,
      reason: actionReason(scene, 'refillWater', state.waterLevel),
    },
    {
      id: 'playdate',
      label: playdates.remaining > 0 ? formatCooldown(playdates.remaining) : 'Playdate',
      onPress: () => {
        setPlayOpen(false);
        setWardrobeOpen(false);
        setPlaydateOpen(true);
      },
    },
    {
      id: 'play',
      label: 'Play',
      onPress: () => {
        setPlayOpen((open) => !open);
      },
      active: playOpen,
    },
  ];

  const practice = (trackId: string) => {
    if (trackId === 'sit') {
      sit();
    } else if (trackId === 'paw') {
      givePaw();
    } else if (trackId === 'speak') {
      speak();
    }
  };
  const learned: PetAction[] = [
    ...(state.training.sit?.mastered ? [{ id: 'sit', label: 'Sit', onPress: sit }] : []),
    ...(species === 'dog' && state.training.paw?.mastered ? [{ id: 'paw', label: 'Give paw', onPress: givePaw }] : []),
    ...(state.training.speak?.mastered ? [{ id: 'speak', label: 'Speak', onPress: speak }] : []),
  ];
  const badges = earnedBadges(state.milestones, species);

  const toggles: PetAction[] = [
    {
      id: 'wardrobe',
      label: 'Wardrobe',
      onPress: () => setWardrobeOpen((open) => !open),
      active: wardrobeOpen,
    },
    {
      id: soundOn ? 'sound' : 'soundOff',
      label: 'Pet sounds',
      onPress: toggleSound,
      active: soundOn,
    },
    {
      id: musicOn ? 'music' : 'musicOff',
      label: 'Music',
      onPress: toggleMusic,
      active: musicOn,
    },
    {
      id: 'personality',
      label: 'Personality',
      onPress: () => setPersonalityOpen((open) => !open),
      active: personalityOpen,
    },
    {
      id: 'help',
      label: 'Help',
      onPress: () => setHelpOpen(true),
      active: helpOpen,
    },
    {
      id: 'inventory',
      label: 'Treats',
      onPress: () => setInventoryOpen((open) => !open),
      active: inventoryOpen,
    },
    {
      id: 'potty',
      label: 'Care alerts',
      onPress: () => setCareRemindersOn(!careRemindersOn),
      active: careRemindersOn,
    },
  ];

  return (
    <View style={styles.root}>
      {celebrating ? (
        <BadgeCelebration
          title={badgeLabels[celebrating] ?? 'Badge'}
          reducedMotion={reducedMotion}
          onDone={finishCelebration}
        />
      ) : null}
      <View style={styles.sticky}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            accessibilityLabel="Boop Boop"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.name} numberOfLines={1}>
            {state.name}
          </Text>
        </View>
        <GestureDetector gesture={gesture}>
          <View collapsable={false} style={{ width: viewWidth, height: viewHeight, alignSelf: 'center' }}>
            <PetView
              cuddleActive={cuddleOn}
              cuddleRef={cuddleHandle}
              onCuddleEvent={onCuddleEvent}
              pet={state}
              cueKind={cue.kind}
              cueToken={cue.token}
              drop={cue.drop}
              flick={cue.flick}
              hour={hour}
              reducedMotion={reducedMotion}
              onWeightDelta={applyActorWeight}
              onEnergyDelta={applyActorEnergy}
              onHungerDelta={applyActorHunger}
              onDrank={reportDrank}
              onAte={reportAte}
              onTraveling={setTraveling}
            />
            {!traveling &&
              state.care.messes
              .filter((mess) => mess.sceneId === state.sceneId)
              .map((mess) => {
                const view = stageToView(mess);
                const stage = messStage(mess.createdAt, state.lastUpdatedAt);
                return (
                  <View
                    key={mess.id}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: view.x - 10,
                      top: view.y - 8,
                      width: 20,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: stage === 'flies' ? '#6b4f2a' : stage === 'stink' ? '#8a6a32' : '#c4a15a',
                    }}
                  />
                );
              })}
            <CuddleFeedback feedbackRef={feedback} reducedMotion={reducedMotion} />
            {ghost && cuddleOn ? (
              <GhostFinger
                key={ghost.key}
                from={ghost.from}
                to={ghost.to}
                reducedMotion={reducedMotion}
                onDone={() => setGhost(null)}
              />
            ) : null}
            {coachVisible ? (
              <CoachMarks
                name={state.name}
                target={coachTarget}
                width={viewWidth}
                height={viewHeight}
                onDone={dismissCoach}
              />
            ) : null}
          </View>
        </GestureDetector>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <NeedRings
          needs={state.needs}
        />
        {welcomeBack ? (
          <Pressable onPress={dismissWelcome} accessibilityRole="button">
            <Text style={styles.hint}>
              {state.name} missed you!
              {state.care.messes.length > 0 ? ' There are messes to clean.' : ''}
            </Text>
          </Pressable>
        ) : null}
        {state.care.potty.signal && !state.seenCoachMarks.includes('potty') ? (
          <Pressable onPress={() => seeCoach('potty')} accessibilityRole="button">
            <Text style={styles.hint}>
              {state.name} needs to go. {species === 'cat' ? 'Tap the litter box.' : 'Tap Go Out.'}
            </Text>
          </Pressable>
        ) : null}
        <CareChips
          potty={state.care.potty.signal != null && !houseTrained(state)}
          pottyLabel={state.sceneId === 'sidewalk' ? 'Head Home' : species === 'cat' ? 'Litter' : 'Go Out'}
          onPotty={() => {
            if (state.sceneId === 'sidewalk') {
              returnHome();
              return;
            }
            goPotty();
          }}
          cleanCount={messesIn(state, state.sceneId).length || state.care.messes.length}
          onClean={() => {
            const here = messesIn(state, state.sceneId);
            if (here.length === 0 && state.care.messes.length > 0) {
              const dest = messDestination(state);
              if (dest) {
                setScene(dest);
              }
              return;
            }
            setCleanOn((on) => !on);
          }}
        />
        {state.care.pendingReward ? (
          <Pressable
            onPress={() => {
              const wallet = economyApi.economy ?? emptyEconomy(Date.now());
              const tier = rewardTierAvailable(wallet, treatTier);
              if (!tier) {
                flash(`Out of treats — next in ${minutesUntilTreat(wallet, Date.now())}m`);
                return;
              }
              const itemId = tier === 'special' ? specialTreatId : basicTreatId;
              if (!economyApi.give(itemId)) {
                return;
              }
              rewardTreat(tier);
              setTreatTier('basic');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.hint}>
              Treat ({treatTier}) ·{' '}
              {stackQty(economyApi.economy ?? emptyEconomy(0), treatTier === 'special' ? specialTreatId : basicTreatId)}
            </Text>
          </Pressable>
        ) : null}
        {inventoryOpen ? (
          <Text style={styles.hint}>
            Biscuits {stackQty(economyApi.economy ?? emptyEconomy(0), basicTreatId)} · Special{' '}
            {stackQty(economyApi.economy ?? emptyEconomy(0), specialTreatId)}
          </Text>
        ) : null}
        <View style={styles.scenes}>
          {sceneList.map((entry) => (
            <Pressable
              key={entry.id}
              style={[styles.scene, entry.id === preset.id && styles.sceneSelected]}
              onPress={() => setScene(entry.id)}
            >
              <Text style={[styles.sceneLabel, entry.id === preset.id && styles.sceneSelectedLabel]}>
                {entry.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <TrainingRings pet={state} species={species} onPractice={practice} />
        {playdates.remaining > 0 ? (
          <Text style={styles.hint}>Next playdate in {formatCooldown(playdates.remaining)}</Text>
        ) : null}
        <ActionButtons actions={actions} species={species} onBlocked={flash} />
        {learned.length > 0 || badges.length > 0 ? (
          <View style={styles.learned}>
            <Text style={styles.sectionTitle}>Learned Tricks</Text>
            {learned.length > 0 ? <ActionButtons actions={learned} species={species} /> : null}
            {badges.length > 0 ? (
              <View style={styles.scenes}>
                {badges.map((badge) => (
                  <View key={badge.id} style={styles.badge} accessible accessibilityLabel={`${badge.label} badge`}>
                    <Text style={styles.badgeLabel}>{badge.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {playOpen ? (
          <View style={styles.scenes}>
            {ownsBall ? (
              <Pressable
                style={[styles.scene, styles.sceneSelected]}
                onPress={() => {
                  setPlayOpen(false);
                  fetchBall();
                }}
              >
                <Text style={[styles.sceneLabel, styles.sceneSelectedLabel]}>Throw ball</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>No toys yet.</Text>
            )}
          </View>
        ) : null}
        <Text style={styles.hint}>
          {note ||
            'With no action running, the pet idles on its own. Tap the stage to soft-drop a ball, or flick to throw.'}
        </Text>
        <ActionButtons actions={toggles} species={species} />
        {wardrobeOpen
          ? (Object.keys(wardrobe) as OutfitSlot[]).map((slot) => (
              <View key={slot} style={styles.scenes}>
                {wardrobe[slot].items.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.scene}
                    onPress={() => equip(slot, item.id === 'none' ? null : item.id)}
                  >
                    <Text style={styles.sceneLabel}>
                      {wardrobe[slot].label} {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))
          : null}
        {personalityOpen ? (
          <View style={styles.personality}>
            <Text style={styles.personalityMeta}>{styleLine}</Text>
            {traits.map((trait) => (
              <Text key={trait} style={styles.score}>
                {traitLabel[trait]} {formatScore(attributeScore(state, trait))} /{' '}
                {state.attributes.potential[trait]}
              </Text>
            ))}
          </View>
        ) : null}
        <CuddleHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
        <DebugPanel
          state={state}
          mood={mood}
          cue={cue}
          onAdvance={advanceBy}
          onAge={setAge}
          onVitality={setVitalityValue}
          onWeight={setWeightValue}
          hour={hour}
          onHour={setHour}
          onReset={reset}
          onNewPet={release}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  sticky: {
    gap: 12,
    paddingBottom: 8,
    backgroundColor: '#F4F7FB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
    zIndex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    paddingHorizontal: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  name: {
    textAlign: 'center',
    // Leaves room on both sides so a long name never runs under the logo.
    marginHorizontal: 60,
    fontSize: 28,
    fontWeight: '700',
    color: '#243044',
  },
  score: {
    fontSize: 14,
    color: '#5C6B80',
  },
  personality: {
    gap: 2,
  },
  personalityMeta: {
    fontSize: 15,
    color: '#243044',
    marginBottom: 4,
  },
  scenes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scene: {
    backgroundColor: '#E4E8EF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sceneLabel: {
    color: '#243044',
    fontSize: 13,
  },
  sceneSelected: {
    backgroundColor: '#2f7d5b',
  },
  sceneSelectedLabel: {
    color: '#fff',
    fontSize: 13,
  },
  learned: {
    gap: 8,
  },
  sectionTitle: {
    color: '#243044',
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: '#FFF3C4',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: '#8A4210',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12.5,
    color: '#5C6B80',
  },
});
