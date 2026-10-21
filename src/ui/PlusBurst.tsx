import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { playPointPop } from '../audio/badge';
import { fontFamily } from './font';

export const plusBurstMs = 820;

const bits = [
  { x: -34, y: -26, size: 8 },
  { x: 32, y: -20, size: 7 },
  { x: -22, y: 18, size: 6 },
  { x: 24, y: 16, size: 8 },
  { x: 2, y: -36, size: 6 },
] as const;

type Props = {
  color: string;
  amount: number;
  label: string;
  reducedMotion: boolean;
};

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

function CartoonLine({ text, color, size }: { text: string; color: string; size: number }) {
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

function Spark({
  color,
  x,
  y,
  size,
  reducedMotion,
}: {
  color: string;
  x: number;
  y: number;
  size: number;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reducedMotion ? 180 : plusBurstMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion]);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const pop = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    return {
      opacity: Math.max(0, 1 - t * 0.9),
      transform: [
        { translateX: reducedMotion ? 0 : x * t },
        { translateY: reducedMotion ? 0 : y * t - 8 * t },
        { scale: 0.3 + Math.max(0, pop) },
      ],
    };
  });
  return <Animated.View style={[styles.bit, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

export function PlusBurst({ color, amount, label, reducedMotion }: Props) {
  const progress = useSharedValue(0);
  useEffect(() => {
    playPointPop();
    progress.value = withTiming(1, {
      duration: reducedMotion ? 180 : plusBurstMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion]);
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const pop = t < 0.16 ? (t / 0.16) * 1.35 : t < 0.32 ? 1.35 - ((t - 0.16) / 0.16) * 0.28 : 1.07;
    const wobble = t < 0.16 ? -18 + (t / 0.16) * 30 : t < 0.4 ? 12 - ((t - 0.16) / 0.24) * 12 : 0;
    const fade = t < 0.08 ? t / 0.08 : t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1;
    const rise = t < 0.28 ? 10 * (1 - t / 0.28) : -46 * ((t - 0.28) / 0.72);
    return {
      opacity: Math.max(0, fade),
      transform: [
        { translateY: reducedMotion ? 0 : rise },
        { scale: reducedMotion ? 1 : pop },
        { rotate: `${reducedMotion ? 0 : wobble}deg` },
      ],
    };
  });
  return (
    <View pointerEvents="none" style={styles.anchor}>
      {bits.map((bit) => (
        <Spark key={`${bit.x}${bit.y}`} color={color} x={bit.x} y={bit.y} size={bit.size} reducedMotion={reducedMotion} />
      ))}
      <Animated.View style={[styles.stack, { shadowColor: color }, style]}>
        <CartoonLine text={`+${amount}`} color={color} size={34} />
        <CartoonLine text={label} color={color} size={18} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    minWidth: 140,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    alignItems: 'center',
    shadowOpacity: 0.28,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 3 },
    elevation: 4,
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
  bit: {
    position: 'absolute',
  },
});
