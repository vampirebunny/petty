import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Anchor, Fence, Footprints, Route, Search, Sparkles, Trophy } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { classLabel, type RaceClass, type RaceEvent } from '../../sim/stadium';
import { fontFamily } from '../font';
import { iconStroke } from '../theme';

export const ink = '#4A3560';
export const softInk = '#7A6390';
export const cardFill = '#FFFFFF';
export const pageFill = '#FBF4FF';

const eventIcons: Record<RaceEvent, LucideIcon> = {
  funRun: Footprints,
  dockDive: Anchor,
  sniffOut: Search,
  trickShow: Sparkles,
  hurdles: Fence,
  weave: Route,
  obstacle: Trophy,
};

const eventColors: Record<RaceEvent, string> = {
  funRun: '#2DAA6C',
  dockDive: '#3A8DDE',
  sniffOut: '#E0A030',
  trickShow: '#7853E6',
  hurdles: '#EE5A8E',
  weave: '#2FA77A',
  obstacle: '#C46B2C',
};

export function EventIcon({ event, size = 26 }: { event: RaceEvent; size?: number }) {
  const Icon = eventIcons[event];
  const color = eventColors[event];
  return (
    <View style={[styles.iconBadge, { width: size + 18, height: size + 18, borderRadius: (size + 18) / 2, shadowColor: color }]}>
      <Icon size={size} strokeWidth={iconStroke + 0.75} color={color} />
    </View>
  );
}

export function PetChip({ name, level, classId }: { name: string; level: number; classId: RaceClass }) {
  return (
    <View style={styles.chip} accessibilityLabel={`${name}, level ${level}, ${classLabel(classId)} class`}>
      <Text style={styles.chipName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.chipMeta}>
        Lv {level} · {classLabel(classId)}
      </Text>
    </View>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.barRow} accessibilityLabel={`${label} ${pct} percent`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function ReadyBars({ energy, mood }: { energy: number; mood: number }) {
  return (
    <View style={styles.bars}>
      <Bar label="Energy" value={energy} color="#7FD8A8" />
      <Bar label="Mood" value={mood} color="#FF9CC2" />
    </View>
  );
}

export function Toast({ message, reducedMotion, onDone }: { message: string; reducedMotion: boolean; onDone: () => void }) {
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) {
      opacity.value = withTiming(1, { duration: 160 });
      opacity.value = withDelay(2200, withTiming(0, { duration: 220 }));
    }
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [message, onDone, opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, style]} accessibilityLiveRegion="polite">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export const shared = StyleSheet.create({
  section: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: ink,
  },
  copy: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: softInk,
  },
  strong: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: ink,
  },
  card: {
    backgroundColor: cardFill,
    borderRadius: 22,
    padding: 14,
    gap: 8,
    shadowColor: '#B79AD9',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});

const styles = StyleSheet.create({
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 120,
    alignItems: 'flex-end',
  },
  chipName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: ink,
  },
  chipMeta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  bars: {
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    width: 54,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: softInk,
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F1E6FA',
    overflow: 'hidden',
  },
  barFill: {
    height: 12,
    borderRadius: 6,
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(74,53,96,0.92)',
    alignItems: 'center',
    zIndex: 40,
  },
  toastText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
