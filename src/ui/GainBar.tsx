import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fontFamily } from './font';
import { theme } from './theme';

type Props = {
  label: string;
  // The shown score before, what was added, and the cap for this pet.
  before: number;
  gain: number;
  potential: number;
  // Grows the green segment and counts the total up. A replay stays still.
  animate?: boolean;
};

const trackMax = 100;
const growMs = 750;

export const gainColors = {
  before: '#243044',
  gain: '#4FC98A',
  potential: '#C9D5E4',
};

export function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, (value / trackMax) * 100))}%`;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

// One attribute: the score before in the app's dark color, what the playdate added in green right after it,
// and the cap as a pale bar behind. The numbers repeat what the bar shows.
export function GainBar({ label, before, gain, potential, animate = false }: Props) {
  const after = before + gain;
  const added = gain >= 0.05 ? `+${formatScore(gain)}` : '+0';
  const progress = useSharedValue(animate ? 0 : 1);
  const [counted, setCounted] = useState(before);
  const shown = animate ? counted : after;

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: growMs, easing: Easing.out(Easing.cubic) });
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / growMs);
      setCounted(before + gain * easeOut(t));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, before, gain, progress]);

  const gainStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${label} ${formatScore(before)} to ${formatScore(after)} of ${formatScore(potential)}, plus ${formatScore(gain)}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { left: 0, width: percent(potential), backgroundColor: gainColors.potential }]} />
        <View style={[styles.fill, { left: 0, width: percent(before), backgroundColor: gainColors.before }]} />
        {gain >= 0.05 ? (
          <Animated.View
            style={[
              styles.fill,
              styles.gainFill,
              { left: percent(before), width: percent(gain), backgroundColor: gainColors.gain },
              gainStyle,
            ]}
          />
        ) : null}
      </View>
      <View style={styles.numbers}>
        <Text style={styles.total}>
          {formatScore(shown)}
          <Text style={styles.cap}> / {formatScore(potential)}</Text>
        </Text>
        <Text style={[styles.added, gain < 0.05 && styles.addedNone]}>{added}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 92,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: theme.muted,
  },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EDF1F6',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  gainFill: {
    transformOrigin: 'left center',
  },
  numbers: {
    width: 84,
    alignItems: 'flex-end',
  },
  total: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: theme.ink,
  },
  cap: {
    fontFamily: fontFamily.regular,
    color: theme.muted,
  },
  added: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: theme.accentDark,
  },
  addedNone: {
    color: theme.muted,
    fontFamily: fontFamily.regular,
  },
});
