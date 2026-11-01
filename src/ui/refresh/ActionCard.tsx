import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { fontFamily } from '../font';
import { PressableCard } from './PressableCard';
import { ui, type RefreshAccent } from './tokens';

type Props = {
  icon: LucideIcon;
  title: string;
  sublabel: string;
  accent: RefreshAccent;
  state?: 'default' | 'suggested' | 'unavailable';
  size?: 'half' | 'full';
  onPress: () => void;
  onUnavailablePress?: () => void;
  reducedMotion?: boolean;
};

export function ActionCard({
  icon: Icon,
  title,
  sublabel,
  accent,
  state = 'default',
  size = 'half',
  onPress,
  onUnavailablePress,
  reducedMotion = false,
}: Props) {
  const tone = ui.accent[accent];
  const unavailable = state === 'unavailable';
  const suggested = state === 'suggested';
  return (
    <View style={size === 'half' ? styles.half : styles.full}>
      <PressableCard
        disabled={unavailable}
        onPress={onPress}
        onDisabledPress={onUnavailablePress}
        reducedMotion={reducedMotion}
        accessibilityLabel={unavailable ? `${title}. ${sublabel}` : title}
      >
        <View style={[styles.body, size === 'full' && styles.row, suggested && styles.suggested]}>
          {suggested ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>Suggested</Text>
            </View>
          ) : null}
          <View style={[styles.icon, { backgroundColor: unavailable ? ui.disabledBg : tone.tint }]}>
            <Icon size={22} strokeWidth={2} color={unavailable ? ui.disabledInk : tone.main} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, unavailable && styles.muted]}>{title}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {sublabel}
            </Text>
          </View>
          {size === 'full' ? <ChevronRight size={18} color={ui.inkMuted} /> : null}
        </View>
      </PressableCard>
    </View>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  half: {
    width: '48%',
  },
  full: {
    alignSelf: 'stretch',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.space.gap,
  },
  body: {
    minHeight: 108,
    padding: 12,
    gap: 8,
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggested: {
    borderWidth: 2,
    borderColor: ui.accent.care.main,
    backgroundColor: ui.glossPink,
    borderRadius: 20,
  },
  pill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: ui.accent.care.main,
    borderRadius: ui.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    color: ui.card,
    fontFamily: fontFamily.fredokaBold,
    fontSize: 11,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 19,
    color: ui.ink,
  },
  muted: {
    color: ui.disabledInk,
  },
  sub: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: ui.inkMuted,
  },
});
