import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';

import { theme } from '../theme';

export type FeedbackHandle = {
  trail: (x: number, y: number) => void;
  heart: (x: number, y: number) => void;
};

type Spark = { id: number; kind: 'trail' | 'heart'; x: number; y: number; dur: number; drift: number };

export const trailMs = 420;
// Hearts alternate between red and pink.
const heartColors = [
  { fill: '#F0506E', stroke: '#B8203F' },
  { fill: '#FFB3C7', stroke: '#E0668A' },
] as const;

export const heartMinMs = 600;
export const heartMaxMs = 800;
const maxSparks = 28;

// A heart lasts 600 to 800 ms.
export function heartDuration(roll: number): number {
  return heartMinMs + Math.min(1, Math.max(0, roll)) * (heartMaxMs - heartMinMs);
}

function TrailDot({ spark, reduced }: { spark: Spark; reduced: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reduced ? 220 : spark.dur, easing: Easing.out(Easing.quad) });
  }, [progress, reduced, spark.dur]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 1 - 0.4 * progress.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.trail, { left: spark.x - 9, top: spark.y - 9 }, style]} />;
}

function FloatingHeart({ spark, reduced }: { spark: Spark; reduced: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: spark.dur, easing: Easing.out(Easing.quad) });
  }, [progress, spark.dur]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * progress.value,
    transform: [
      { translateY: reduced ? 0 : -48 * progress.value },
      { translateX: reduced ? 0 : spark.drift * progress.value },
      { scale: 0.8 + 0.3 * Math.min(1, progress.value * 3) },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.heart, { left: spark.x - 10, top: spark.y - 24 }, style]}>
      <Heart
        size={20}
        strokeWidth={1.75}
        color={heartColors[spark.id % 2].stroke}
        fill={heartColors[spark.id % 2].fill}
      />
    </Animated.View>
  );
}

type Props = {
  feedbackRef?: Ref<FeedbackHandle>;
  reducedMotion: boolean;
};

// Soft trail dots under the finger and hearts that float up. Both are short-lived and never take touches.
export function CuddleFeedback({ feedbackRef, reducedMotion }: Props) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const add = useCallback((spark: Omit<Spark, 'id'>) => {
    const id = nextId.current;
    nextId.current += 1;
    setSparks((current) => [...current.slice(-(maxSparks - 1)), { ...spark, id }]);
    timers.current.push(
      setTimeout(() => {
        setSparks((current) => current.filter((entry) => entry.id !== id));
      }, spark.dur + 80),
    );
  }, []);

  useImperativeHandle(
    feedbackRef,
    () => ({
      trail: (x, y) => add({ kind: 'trail', x, y, dur: trailMs, drift: 0 }),
      heart: (x, y) => add({ kind: 'heart', x, y, dur: heartDuration(Math.random()), drift: (Math.random() - 0.5) * 18 }),
    }),
    [add],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparks.map((spark) =>
        spark.kind === 'trail' ? (
          <TrailDot key={spark.id} spark={spark} reduced={reducedMotion} />
        ) : (
          <FloatingHeart key={spark.id} spark={spark} reduced={reducedMotion} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trail: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  heart: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
});
