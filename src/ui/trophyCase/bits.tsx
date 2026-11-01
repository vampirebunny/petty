import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '../font';
import { caseTokens } from './tokens';

export function caseTileWidth(paneWidth: number, min = 158, gap = 10, maxCols = 4): number {
  if (paneWidth <= 0) {
    return min;
  }
  const cols = Math.min(maxCols, Math.max(2, Math.floor((paneWidth + gap) / (min + gap))));
  return (paneWidth - gap * (cols - 1)) / cols;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Bar({ have, need }: { have: number; need: number }) {
  const ratio = need > 0 ? Math.min(1, have / need) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
    </View>
  );
}

export function formatAwardDate(value: string | number | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function wonLine(name: string | null | undefined, earnedAt: string | null | undefined, classId?: string | null) {
  const bits = [name ? `Won by ${name}` : null, formatAwardDate(earnedAt), classId ? titleWord(classId) : null].filter(Boolean);
  return bits.join(' · ');
}

function titleWord(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: caseTokens.ink,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EFE4D2',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#C9A24A',
  },
});
