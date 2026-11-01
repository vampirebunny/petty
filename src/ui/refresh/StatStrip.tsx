import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fontFamily } from '../font';
import { ui } from './tokens';

type StatKey = keyof typeof ui.stat;

const words: Record<StatKey, { min: number; text: string }[]> = {
  tummy: [
    { min: 75, text: 'Yummy!' },
    { min: 50, text: 'Peckish' },
    { min: 25, text: 'Rumbly' },
    { min: 0, text: 'Starving!' },
  ],
  water: [
    { min: 75, text: 'Full' },
    { min: 50, text: 'Sipping' },
    { min: 25, text: 'Thirsty' },
    { min: 0, text: 'Parched!' },
  ],
  energy: [
    { min: 75, text: 'Zoomy!' },
    { min: 50, text: 'Chill' },
    { min: 25, text: 'Sleepy' },
    { min: 0, text: 'Exhausted!' },
  ],
  mood: [
    { min: 75, text: 'Joyful!' },
    { min: 50, text: 'Content' },
    { min: 25, text: 'Meh' },
    { min: 0, text: 'Gloomy!' },
  ],
};

const labels: Record<StatKey, string> = {
  tummy: 'Tummy',
  water: 'Water',
  energy: 'Energy',
  mood: 'Mood',
};

export function needWord(key: StatKey, value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  return (words[key].find((tier) => clamped >= tier.min) ?? words[key][words[key].length - 1]).text;
}

function Bar({ value, color, track, reducedMotion }: { value: number; color: string; track: string; reducedMotion: boolean }) {
  const width = useSharedValue(reducedMotion ? value : 0);
  useEffect(() => {
    width.value = reducedMotion ? value : withTiming(value, { duration: 300 });
  }, [reducedMotion, value, width]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, width.value))}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

type Props = {
  tummy: number;
  water: number;
  energy: number;
  mood: number;
  reducedMotion: boolean;
};

export function StatStrip({ tummy, water, energy, mood, reducedMotion }: Props) {
  const columns: { key: StatKey; value: number }[] = [
    { key: 'tummy', value: tummy },
    { key: 'water', value: water },
    { key: 'energy', value: energy },
    { key: 'mood', value: mood },
  ];
  return (
    <View style={styles.card}>
      {columns.map((column) => {
        const tone = ui.stat[column.key];
        const shown = Math.round(Math.max(0, Math.min(100, column.value)));
        return (
          <View key={column.key} style={styles.col}>
            <Text style={[styles.value, { color: tone.label }]} numberOfLines={1}>
              {labels[column.key]} {shown}%
            </Text>
            <Bar value={shown} color={tone.fill} track={tone.track} reducedMotion={reducedMotion} />
            <Text style={styles.word} numberOfLines={1}>
              {needWord(column.key, shown)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: ui.card,
    borderRadius: ui.radius.card,
    paddingVertical: 7,
    paddingHorizontal: 8,
    minHeight: 60,
    shadowColor: ui.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  col: {
    flex: 1,
    gap: 3,
    paddingHorizontal: 4,
  },
  value: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
  },
  word: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: ui.inkMuted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
