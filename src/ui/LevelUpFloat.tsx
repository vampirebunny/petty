import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fontFamily } from './font';
import { tints } from './candy';

type Props = {
  level: number;
  boops: number;
  reducedMotion: boolean;
  onDone: () => void;
};

const riseMs = 1700;

const stroke = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
  [-1.5, -1.5],
  [1.5, -1.5],
  [-1.5, 1.5],
  [1.5, 1.5],
] as const;

function Line({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <View style={styles.line}>
      {stroke.map(([x, y]) => (
        <Text
          key={`${x}${y}`}
          style={[styles.ink, styles.edge, { fontSize: size, transform: [{ translateX: x }, { translateY: y }] }]}
        >
          {text}
        </Text>
      ))}
      <Text style={[styles.ink, { fontSize: size, color }]}>{text}</Text>
    </View>
  );
}

// Rises from the bottom of the scene to the top, then fades out. Never takes taps.
export function LevelUpFloat({ level, boops, reducedMotion, onDone }: Props) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  const progress = useSharedValue(0);
  const travel = useSharedValue(320);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: reducedMotion ? 420 : riseMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(done.current)();
        }
      },
    );
  }, [level, progress, reducedMotion]);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const span = Math.max(120, travel.value - 96);
    const fadeIn = t < 0.08 ? t / 0.08 : 1;
    const fadeOut = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
    return {
      opacity: Math.max(0, fadeIn * fadeOut),
      transform: [
        { translateY: reducedMotion ? span * 0.45 : span * (1 - t) },
        { scale: reducedMotion ? 1 : 1 - t * 0.08 },
      ],
    };
  });
  return (
    <View
      pointerEvents="none"
      style={styles.layer}
      onLayout={(event) => {
        travel.value = event.nativeEvent.layout.height;
      }}
    >
      <Animated.View style={[styles.stack, style]} accessibilityLiveRegion="polite" accessibilityLabel={`Level ${level}`}>
        <Line text={`Level ${level}`} color={tints.pink.icon} size={36} />
        {boops > 0 ? <Line text={`+${boops} Boops`} color={tints.butter.icon} size={22} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  stack: {
    alignItems: 'center',
  },
  line: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ink: {
    fontFamily: fontFamily.black,
    textAlign: 'center',
  },
  edge: {
    position: 'absolute',
    color: '#FFFFFF',
  },
});
