import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, Pressable, ScrollView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  actionReason,
  compileScene,
  sceneById,
  sceneList,
  sceneSource,
  stagePoint,
  wardrobe,
} from '../actor';
import type { Scene } from '../actor';
import { setSoundEnabled } from '../audio/voice';
import { stageHeight, stageWidth } from '../actor/geometry';
import { archetypeNames, attributeScore, petStrokeIntervalMs, traits } from '../sim';
import type { OutfitSlot, Trait } from '../sim';
import { loadSoundEnabled, saveSoundEnabled } from '../storage/session';
import { usePet } from '../state/usePet';
import { ActionButtons } from '../ui/ActionButtons';
import type { PetAction } from '../ui/ActionButtons';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedBars } from '../ui/NeedBars';
import { PetView } from '../ui/PetView';
import { SceneEditor } from '../ui/SceneEditor';

type Props = {
  petApi: ReturnType<typeof usePet>;
  onClearAttestation: () => void;
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

export default function HomeScreen({ petApi, onClearAttestation }: Props) {
  const {
    state,
    mood,
    cue,
    remindersOn,
    setRemindersOn,
    feed,
    drink,
    idle,
    sit,
    givePaw,
    speak,
    rest,
    pet,
    fetchBall,
    throwAt,
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
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  // A scene typed into the editor. It lives only on this screen; the pet's saved scene stays a preset.
  const [custom, setCustom] = useState<{ scene: Scene; source: unknown } | null>(null);
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

  const applyScene = useCallback((text: string): string => {
    let source: unknown;
    try {
      source = JSON.parse(text);
    } catch (error) {
      return `That is not valid JSON: ${error instanceof Error ? error.message : 'unreadable'}`;
    }
    try {
      setCustom({ scene: compileScene(source), source });
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'That scene could not be loaded.';
    }
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

  const throwHere = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight);
      throwAt(point.x, point.y);
    },
    [throwAt, viewHeight, viewWidth],
  );
  const throwRef = useRef(throwHere);
  const strokeRef = useRef(stroke);
  useEffect(() => {
    throwRef.current = throwHere;
    strokeRef.current = stroke;
  }, [stroke, throwHere]);
  const onTapStage = useCallback((x: number, y: number) => {
    throwRef.current(x, y);
  }, []);
  const onStrokeStage = useCallback(() => {
    strokeRef.current();
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
      });
    return Gesture.Exclusive(tap, pan);
  }, [onStrokeStage, onTapStage]);
  const preset = sceneById(state?.sceneId ?? 'livingroom');
  const scene = custom?.scene ?? preset;
  const sceneJson = useMemo(
    () => JSON.stringify(custom?.source ?? sceneSource(preset.id), null, 2),
    [custom, preset.id],
  );

  if (!state || !mood) {
    return null;
  }

  const actions: PetAction[] = [
    { id: 'idle', label: 'Idle', onPress: idle },
    { id: 'sit', label: 'Sit', onPress: sit },
    { id: 'paw', label: 'Give paw', onPress: givePaw },
    { id: 'speak', label: 'Speak', onPress: speak },
    { id: 'rest', label: state.asleep ? 'Wake' : 'Sleep', onPress: rest },
    { id: 'feed', label: 'Eat', onPress: feed, reason: actionReason(scene, 'feed') },
    { id: 'drink', label: 'Drink', onPress: drink, reason: actionReason(scene, 'drink') },
    { id: 'throw', label: 'Throw ball', onPress: fetchBall, primary: true },
  ];

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.name}>{state.name}</Text>
        <Text style={styles.meta}>
          {archetypeNames[state.attributes.archetype]} · Level {state.level}
        </Text>
        {traits.map((trait) => (
          <Text key={trait} style={styles.score}>
            {traitLabel[trait]} {formatScore(attributeScore(state, trait))} / {state.attributes.potential[trait]}
          </Text>
        ))}
      </View>
      <NeedBars needs={state.needs} />
      <GestureDetector gesture={gesture}>
        <View collapsable={false} style={{ width: viewWidth, height: viewHeight }}>
          <PetView
            pet={state}
            cueKind={cue.kind}
            cueToken={cue.token}
            drop={cue.drop}
            hour={hour}
            reducedMotion={reducedMotion}
            sceneOverride={custom?.scene ?? null}
            onStatus={setStatus}
            onWeightDelta={applyActorWeight}
          />
          <View pointerEvents="none" style={styles.status}>
            <Text style={styles.statusText}>
              Now: <Text style={styles.statusStrong}>{status || 'idle'}</Text>
            </Text>
          </View>
        </View>
      </GestureDetector>
      <View style={styles.scenes}>
        {sceneList.map((entry) => (
          <Pressable
            key={entry.id}
            style={[styles.scene, !custom && entry.id === preset.id && styles.sceneSelected]}
            onPress={() => {
              setCustom(null);
              setScene(entry.id);
            }}
          >
            <Text style={[styles.sceneLabel, !custom && entry.id === preset.id && styles.sceneSelectedLabel]}>
              {entry.name}
            </Text>
          </Pressable>
        ))}
        {custom ? (
          <View style={[styles.scene, styles.sceneSelected]}>
            <Text style={styles.sceneSelectedLabel}>Custom</Text>
          </View>
        ) : null}
      </View>
      <ActionButtons actions={actions} onBlocked={flash} />
      <Text style={styles.hint}>
        {note || 'With no action running, the pet idles on its own: it wanders, sits, grooms and naps. Tap the stage to throw the ball.'}
      </Text>
      <Pressable onPress={() => setWardrobeOpen((open) => !open)}>
        <Text style={styles.switchLabel}>{wardrobeOpen ? 'Hide wardrobe' : 'Wardrobe'}</Text>
      </Pressable>
      {wardrobeOpen
        ? (Object.keys(wardrobe) as OutfitSlot[]).map((slot) => (
            <View key={slot} style={styles.scenes}>
              {wardrobe[slot].items.map((item) => (
                <Pressable key={item.id} style={styles.scene} onPress={() => equip(slot, item.id === 'none' ? null : item.id)}>
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
      <SceneEditor
        source={sceneJson}
        onApply={applyScene}
        onReset={() => {
          setCustom(null);
          setScene(preset.id);
        }}
      />
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
        onClearAttestation={onClearAttestation}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 32,
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
    marginBottom: 4,
  },
  score: {
    fontSize: 14,
    color: '#5C6B80',
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
  status: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#5C6B80',
  },
  statusStrong: {
    color: '#243044',
    fontWeight: '600',
  },
  switch: {
    alignSelf: 'flex-start',
  },
  switchLabel: {
    fontSize: 15,
    color: '#243044',
  },
});
