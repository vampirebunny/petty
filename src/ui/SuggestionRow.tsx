import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import {
  Cookie,
  Droplet,
  HandHeart,
  Map,
  Moon,
  PawPrint,
  Shirt,
  Sparkles,
  Volleyball,
  Flag,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { suggestionLabel } from '../sim/suggestions';
import type { SuggestionSlot } from '../sim/types';
import { fontFamily } from './font';

type PillProps = {
  suggestions: SuggestionSlot[];
  species: 'dog' | 'cat';
  onCheer?: () => void;
};

function iconFor(id: string): LucideIcon {
  const action = id.startsWith('tutorial:') ? id.slice('tutorial:'.length) : id;
  if (action === 'feed') return Cookie;
  if (action === 'water') return Droplet;
  if (action === 'nap') return Moon;
  if (action === 'pat' || action === 'cuddle') return HandHeart;
  if (action === 'play' || action.startsWith('toy:')) return Volleyball;
  if (action === 'hat' || action === 'closet') return Shirt;
  if (action === 'find') return Sparkles;
  if (action === 'race') return Flag;
  if (action === 'friendGame') return Users;
  if (action.startsWith('practice:') || action.startsWith('progress:') || action === 'sit' || action === 'school') {
    return PawPrint;
  }
  return Map;
}

export function PulseScale({ on, reducedMotion, children }: { on: boolean; reducedMotion: boolean; children: ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!on || reducedMotion) {
      scale.value = withTiming(1, { duration: 120 });
      return;
    }
    scale.value = withRepeat(withSequence(withTiming(1.08, { duration: 280 }), withTiming(1, { duration: 280 })), 6, false);
  }, [on, reducedMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function SuggestionPill({ suggestions, species, onCheer }: PillProps) {
  const hidden = useRef(new Set<string>());
  const [tick, setTick] = useState(0);
  const ids = suggestions.map((slot) => slot.id).join('|');
  const cheer = useRef(onCheer);
  cheer.current = onCheer;
  const seenIds = useRef<string | null>(null);

  useEffect(() => {
    const live = new Set(ids ? ids.split('|') : []);
    for (const id of hidden.current) {
      if (!live.has(id)) {
        hidden.current.delete(id);
      }
    }
    const before = seenIds.current;
    seenIds.current = ids;
    if (before != null) {
      const previous = new Set(before ? before.split('|') : []);
      if ([...live].some((id) => !previous.has(id))) {
        cheer.current?.();
      }
    }
  }, [ids]);

  const tip = suggestions.find((slot) => !hidden.current.has(slot.id));
  if (!tip) {
    return null;
  }
  const Icon = iconFor(tip.id);
  const label = suggestionLabel(tip.id, species);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Try this. ${label}`}
      onPress={() => {
        hidden.current.add(tip.id);
        setTick(tick + 1);
      }}
      style={styles.pill}
    >
      <View style={styles.icon}>
        <Icon size={16} strokeWidth={2.4} color="#9A4A12" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>Try this</Text>
        <Text style={styles.tip} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 240,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 22,
    backgroundColor: '#FFF6FB',
    borderWidth: 1,
    borderColor: '#F3D3E2',
    shadowColor: '#E98DAE',
    shadowOpacity: 0.28,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE4F0',
  },
  copy: {
    flexShrink: 1,
  },
  kicker: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 10,
    lineHeight: 12,
    color: '#C04D78',
  },
  tip: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#5C3A4A',
  },
});
