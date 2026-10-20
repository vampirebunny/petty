import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Bone, Heart, Zap } from 'lucide-react-native';

import { playPointPop } from '../../audio/badge';
import { theme } from '../theme';

export type FeedbackHandle = {
  trail: (x: number, y: number) => void;
  heart: (x: number, y: number) => void;
  energyGain: (x: number, y: number) => void;
  tummyGain: (x: number, y: number, amount: number) => void;
};

type Spark = {
  id: number;
  kind: 'trail' | 'heart' | 'energy' | 'tummy';
  x: number;
  y: number;
  dur: number;
  drift: number;
  label?: string;
};

export const trailMs = 420;
// Hearts alternate between red and pink.
const heartColors = [
  { fill: '#F0506E', stroke: '#B8203F' },
  { fill: '#FFB3C7', stroke: '#E0668A' },
] as const;

export const heartMinMs = 600;
export const heartMaxMs = 800;
export const energyPopMs = 1200;
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

function FloatingNeed({
  spark,
  reduced,
  tint,
  icon: Icon,
}: {
  spark: Spark;
  reduced: boolean;
  tint: { bg: string; edge: string; strong: string; ink: string };
  icon: typeof Zap;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: spark.dur, easing: Easing.out(Easing.cubic) });
  }, [progress, spark.dur]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const pop = p < 0.18 ? 0.35 + (p / 0.18) * 1.05 : p < 0.32 ? 1.4 - ((p - 0.18) / 0.14) * 0.28 : 1.12;
    const fade = p < 0.12 ? p / 0.12 : p > 0.62 ? 1 - (p - 0.62) / 0.38 : 1;
    return {
      opacity: Math.max(0, fade),
      transform: [
        { translateY: reduced ? 0 : -78 * p },
        { translateX: reduced ? 0 : spark.drift * p },
        { scale: reduced ? 1 : pop },
        { rotate: `${reduced ? 0 : (1 - p) * -8}deg` },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.needBurst,
        { left: spark.x - 36, top: spark.y - 22, backgroundColor: tint.bg, borderColor: tint.strong, shadowColor: tint.ink },
        style,
      ]}
    >
      <Icon size={16} strokeWidth={2.6} color={tint.ink} fill={tint.strong} />
      <Text style={[styles.needBurstText, { color: tint.ink }]}>{spark.label ?? '+10'}</Text>
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
      energyGain: (x, y) => {
        playPointPop();
        add({ kind: 'energy', x, y, dur: energyPopMs, drift: (Math.random() - 0.5) * 10, label: '+10' });
      },
      tummyGain: (x, y, amount) => {
        playPointPop();
        add({ kind: 'tummy', x, y, dur: energyPopMs, drift: (Math.random() - 0.5) * 10, label: `+${Math.round(amount)}` });
      },
    }),
    [add],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparks.map((spark) =>
        spark.kind === 'trail' ? (
          <TrailDot key={spark.id} spark={spark} reduced={reducedMotion} />
        ) : spark.kind === 'energy' ? (
          <FloatingNeed
            key={spark.id}
            spark={spark}
            reduced={reducedMotion}
            tint={{ bg: '#DDF6E8', edge: '#A6DFC0', strong: '#4FC98A', ink: '#14503A' }}
            icon={Zap}
          />
        ) : spark.kind === 'tummy' ? (
          <FloatingNeed
            key={spark.id}
            spark={spark}
            reduced={reducedMotion}
            tint={{ bg: '#FFE9D6', edge: '#F7C49A', strong: '#FF9F5A', ink: '#8A4210' }}
            icon={Bone}
          />
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
  needBurst: {
    position: 'absolute',
    minWidth: 72,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  needBurstText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
