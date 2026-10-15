import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { petStrokeIntervalMs } from '../sim';
import { usePet } from '../state/usePet';
import { ActionButtons } from '../ui/ActionButtons';
import { DebugPanel } from '../ui/DebugPanel';
import { NeedBars } from '../ui/NeedBars';
import { PetView } from '../ui/PetView';

export default function HomeScreen() {
  const { state, mood, cue, feed, rest, pet, advanceBy, reset } = usePet();
  const lastStrokeAt = useRef(0);

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
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(pet)();
  });
  const gesture = Gesture.Exclusive(pan, tap);

  if (!state || !mood) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Boop Boop</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <NeedBars needs={state.needs} />
      <View style={styles.scene}>
        <GestureDetector gesture={gesture}>
          <View collapsable={false}>
            <PetView needs={state.needs} mood={mood} cue={cue.kind} cueToken={cue.token} />
          </View>
        </GestureDetector>
        <View style={styles.ground} />
      </View>
      <ActionButtons asleep={state.asleep} onFeed={feed} onRest={rest} />
      <DebugPanel state={state} mood={mood} cue={cue} onAdvance={advanceBy} onReset={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FB',
  },
  loadingText: {
    fontSize: 20,
    color: '#243044',
  },
  scene: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ground: {
    alignSelf: 'stretch',
    height: 2,
    backgroundColor: '#243044',
    marginTop: 4,
  },
});
