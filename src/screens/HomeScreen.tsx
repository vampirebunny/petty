import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { actionEnabled, sceneById, sceneList, stagePoint, wardrobe } from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
import { attributeScore, petStrokeIntervalMs, traits } from '../sim';
import type { OutfitSlot, Trait } from '../sim';
import { usePet } from '../state/usePet';
import { ActionButtons } from '../ui/ActionButtons';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedBars } from '../ui/NeedBars';
import { PetView } from '../ui/PetView';

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
  } = petApi;
  const lastStrokeAt = useRef(0);
  const { width } = useWindowDimensions();
  const viewWidth = Math.max(280, width - 40);
  const viewHeight = viewWidth * (stageHeight / stageWidth);
  const [hour, setHour] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);

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

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate(() => {
      runOnJS(stroke)();
    });
  const throwHere = useCallback(
    (x: number, y: number) => {
      const point = stagePoint(x, y, viewWidth, viewHeight);
      throwAt(point.x, point.y);
    },
    [throwAt, viewHeight, viewWidth],
  );
  const tap = Gesture.Tap().onEnd((event) => {
    runOnJS(throwHere)(event.x, event.y);
  });
  const gesture = Gesture.Exclusive(pan, tap);
  const scene = sceneById(state?.sceneId ?? 'livingroom');

  if (!state || !mood) {
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.name}>{state.name}</Text>
        <Text style={styles.meta}>
          {state.temperament.label} · Level {state.level}
        </Text>
        {traits.map((trait) => (
          <Text key={trait} style={styles.score}>
            {traitLabel[trait]} {formatScore(attributeScore(state, trait))} / {state.potential[trait]}
          </Text>
        ))}
      </View>
      <NeedBars needs={state.needs} />
      <GestureDetector gesture={gesture}>
        <View collapsable={false}>
          <PetView
            pet={state}
            cueKind={cue.kind}
            cueToken={cue.token}
            drop={cue.drop}
            hour={hour}
            reducedMotion={reducedMotion}
            onWeightDelta={applyActorWeight}
          />
        </View>
      </GestureDetector>
      <View style={styles.scenes}>
        {sceneList.map((entry) => (
          <Pressable key={entry.id} style={styles.scene} onPress={() => setScene(entry.id)}>
            <Text style={styles.sceneLabel}>{entry.name}</Text>
          </Pressable>
        ))}
      </View>
      <ActionButtons
        asleep={state.asleep}
        canFeed={actionEnabled(scene, 'feed')}
        canDrink={actionEnabled(scene, 'drink')}
        canRest={state.asleep || actionEnabled(scene, 'rest')}
        onFeed={feed}
        onDrink={drink}
        onRest={rest}
        onThrow={fetchBall}
      />
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
  switch: {
    alignSelf: 'flex-start',
  },
  switchLabel: {
    fontSize: 15,
    color: '#243044',
  },
});
