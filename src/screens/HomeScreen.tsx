import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { setSoundEnabled } from '../audio/voice';
import { stageHeight, stageWidth } from '../actor/geometry';
import { flickSpeedThreshold } from '../input/flick';
import { archetypeNames, archetypeStyleNames, attributeScore, currentStyle, petStrokeIntervalMs, traits } from '../sim';
import type { OutfitSlot, Trait } from '../sim';
import { loadSoundEnabled, saveSoundEnabled } from '../storage/session';
import { usePet } from '../state/usePet';
import { ActionButtons } from '../ui/ActionButtons';
import type { PetAction } from '../ui/ActionButtons';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedBars } from '../ui/NeedBars';
import { PetView } from '../ui/PetView';

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
  const viewWidth = Math.max(280, width - 40);
  const viewHeight = viewWidth * (stageHeight / stageWidth);
  const [hour, setHour] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [note, setNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadSoundEnabled().then((enabled) => {
      if (mounted) {
        setSoundOn(enabled);
        setSoundEnabled(enabled);
      }
    });
    return () => {
      mounted = false;
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
  }, [onFlickStage, onStrokeStage, onTapStage]);
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
    { id: 'rest', label: state.asleep ? 'Wake' : 'Sleep', onPress: rest },
    {
      id: 'feed',
      label: 'Feed',
      onPress: () => {
        setPlayOpen(false);
        setFeedOpen((open) => !open);
      },
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
      primary: true,
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.sticky}>
        <View style={styles.header}>
          <Text style={styles.name}>{state.name}</Text>
          <Text style={styles.meta}>Level {state.level}</Text>
        </View>
        <GestureDetector gesture={gesture}>
          <View collapsable={false} style={{ width: viewWidth, height: viewHeight }}>
            <PetView
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
          </View>
        </GestureDetector>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <NeedBars needs={state.needs} />
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
        <ActionButtons actions={actions} onBlocked={flash} />
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
        <Pressable onPress={() => setWardrobeOpen((open) => !open)}>
          <Text style={styles.switchLabel}>{wardrobeOpen ? 'Hide wardrobe' : 'Wardrobe'}</Text>
        </Pressable>
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
        <Pressable style={styles.switch} onPress={() => setRemindersOn(!remindersOn)}>
          <Text style={styles.switchLabel}>Reminders {remindersOn ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.switch} onPress={toggleSound}>
          <Text style={styles.switchLabel}>Sound {soundOn ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.switch} onPress={() => setPersonalityOpen((open) => !open)}>
          <Text style={styles.switchLabel}>
            {personalityOpen ? `Hide ${state.name}'s personality` : `${state.name}'s personality`}
          </Text>
        </Pressable>
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
    paddingHorizontal: 20,
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
    gap: 2,
  },
  name: {
    fontSize: 28,
    color: '#243044',
  },
  meta: {
    fontSize: 16,
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
  switch: {
    alignSelf: 'flex-start',
  },
  switchLabel: {
    fontSize: 15,
    color: '#243044',
  },
});
