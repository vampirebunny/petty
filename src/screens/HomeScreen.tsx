import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import {
  ghostDelayMs,
  ghostEligible,
  loadCoachSeen,
  saveCoachSeen,
  startCuddleSession,
} from '../cuddle/guidance';
import { ActionButtons } from '../ui/ActionButtons';
import type { PetAction } from '../ui/ActionButtons';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedRings } from '../ui/NeedRings';
import { PetView } from '../ui/PetView';
import type { CuddleHandle } from '../ui/PetView';
import { CuddleFeedback } from '../ui/cuddle/CuddleFeedback';
import type { FeedbackHandle } from '../ui/cuddle/CuddleFeedback';
import { CoachMarks, CuddleHelpSheet, CuddleHintPill, GhostFinger } from '../ui/cuddle/CuddleGuidance';

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
    remindersOn,
    setRemindersOn,
    feed,
    refillWater,
    reportDrank,
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
    advanceBy,
    setAge,
    setVitalityValue,
    setWeightValue,
    reset,
    release,
  } = petApi;
  const lastStrokeAt = useRef(0);
  const { width } = useWindowDimensions();
  const viewWidth = Math.max(280, width);
  const viewHeight = viewWidth * (stageHeight / stageWidth);
  const [hour, setHour] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [cuddleOn, setCuddleOn] = useState(false);
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
      throwAt(point.x, point.y);
    },
    [throwAt, viewHeight, viewWidth],
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
    [acceptingTouch, viewHeight, viewWidth],
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
        handle.touch({ kind: 'boop', zone: 'nose', x: stage.x });
      }
    },
    [acceptingTouch, viewHeight, viewWidth],
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

  const preset = sceneById(state?.sceneId ?? 'livingroom');
  const scene = preset;

  if (!state || !mood) {
    return null;
  }

  const origin = state.attributes.archetype;
  const style = currentStyle(origin, state.attributes.current, state.attributes.potential);
  const styleLine =
    style === origin
      ? archetypeNames[origin]
      : `Born: ${archetypeNames[origin]} · Style: ${archetypeStyleNames[style]}`;
  const species = breedById(state.breedId)?.species ?? 'dog';
  const mealLabel = species === 'cat' ? 'Cat food' : 'Kibble';
  const ownsBall = state.toys.includes('ball');

  const actions: PetAction[] = [
    { id: 'sit', label: 'Sit', onPress: sit },
    { id: 'paw', label: 'Give paw', onPress: givePaw },
    { id: 'speak', label: 'Speak', onPress: speak },
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
        setFeedOpen((open) => !open);
      },
      active: feedOpen,
      reason: actionReason(scene, 'feed'),
    },
    {
      id: 'refill',
      label: 'Refill water',
      onPress: refillWater,
      reason: actionReason(scene, 'refillWater', state.waterLevel),
    },
    {
      id: 'play',
      label: 'Play',
      onPress: () => {
        setFeedOpen(false);
        setPlayOpen((open) => !open);
      },
      active: playOpen,
    },
  ];

  const toggles: PetAction[] = [
    {
      id: 'wardrobe',
      label: 'Wardrobe',
      onPress: () => setWardrobeOpen((open) => !open),
      active: wardrobeOpen,
    },
    {
      id: 'reminders',
      label: 'Reminders',
      onPress: () => setRemindersOn(!remindersOn),
      active: remindersOn,
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
  ];

  return (
    <View style={styles.root}>
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
          <View collapsable={false} style={{ width: viewWidth, height: viewHeight }}>
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
              onDrank={reportDrank}
            />
            <CuddleFeedback feedbackRef={feedback} reducedMotion={reducedMotion} />
            {cuddleOn ? <CuddleHintPill /> : null}
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
        <NeedRings needs={state.needs} />
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
        <ActionButtons actions={actions} species={species} onBlocked={flash} />
        {feedOpen ? (
          <View style={styles.scenes}>
            <Pressable
              style={styles.scene}
              onPress={() => {
                setFeedOpen(false);
                feed();
              }}
            >
              <Text style={styles.sceneLabel}>{mealLabel}</Text>
            </Pressable>
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
    minHeight: 36,
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    left: 20,
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  name: {
    textAlign: 'center',
    // Leaves room on both sides so a long name never runs under the logo.
    marginHorizontal: 44,
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
  hint: {
    fontSize: 12.5,
    color: '#5C6B80',
  },
});
