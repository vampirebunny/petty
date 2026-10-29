import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { fontFamily } from './font';

type Props = {
  level: number;
  into: number;
  need: number;
  reducedMotion: boolean;
};

export function LevelBar({ level, into, need, reducedMotion }: Props) {
  const fraction = need <= 0 ? 1 : Math.max(0, Math.min(1, into / need));
  const fill = useSharedValue(fraction);
  const seenLevel = useRef(level);
  useEffect(() => {
    const leveled = level > seenLevel.current;
    seenLevel.current = level;
    if (reducedMotion) {
      fill.value = fraction;
      return;
    }
    if (leveled) {
      fill.value = withSequence(withTiming(1, { duration: 320 }), withTiming(fraction, { duration: 240 }));
      return;
    }
    fill.value = withTiming(fraction, { duration: 280 });
  }, [fill, fraction, level, reducedMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const caption = need <= 0 ? 'Level 100' : `${Math.floor(into)} / ${Math.round(need)}`;
  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={`Level ${level}. ${caption}`}>
      <Text style={styles.level} numberOfLines={1}>
        Level {level}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  level: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    lineHeight: 14,
    color: '#5C6B80',
  },
  track: {
    width: 112,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E8EF',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF7BA5',
  },
});
