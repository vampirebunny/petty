import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { candyInk } from '../candy';
import { fontFamily } from '../font';
import { PressableCard } from './PressableCard';
import { ui, type RefreshAccent } from './tokens';

type Props = {
  icon: LucideIcon;
  title: string;
  sublabel: string;
  accent: RefreshAccent;
  state?: 'default' | 'suggested' | 'unavailable';
  size?: 'quarter' | 'half' | 'full';
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
  const candy = ui.candy[accent];
  const unavailable = state === 'unavailable';
  const suggested = state === 'suggested';
  const ink = unavailable ? ui.disabledInk : candyInk(candy);
  const quarter = size === 'quarter';
  const stacked = size !== 'full';
  return (
    <View style={styles[size]}>
      <PressableCard
        disabled={unavailable}
        tint={candy}
        radius={quarter ? 18 : ui.radius.card}
        onPress={onPress}
        onDisabledPress={onUnavailablePress}
        reducedMotion={reducedMotion}
        accessibilityLabel={unavailable ? `${title}. ${sublabel}` : title}
      >
        <View
          style={[styles.body, quarter && styles.bodyQuarter, size === 'full' && styles.row, suggested && styles.suggested]}
        >
          <View style={[styles.icon, quarter && styles.iconQuarter, unavailable ? styles.iconOff : { shadowColor: candy.lip }]}>
            <Icon size={quarter ? 18 : 22} strokeWidth={2.25} color={unavailable ? ui.disabledInk : candy.icon} />
          </View>
          <View style={[styles.copy, size === 'full' && styles.copyRow]}>
            <Text
              style={[styles.title, quarter && styles.titleQuarter, stacked && styles.centered, { color: ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.sub,
                quarter && styles.subQuarter,
                stacked && styles.centered,
                { color: unavailable ? ui.disabledInk : candy.ink },
              ]}
              numberOfLines={2}
            >
              {sublabel}
            </Text>
          </View>
          {size === 'full' ? (
            <View style={styles.chevron}>
              <ChevronRight size={18} color={ink} />
            </View>
          ) : null}
        </View>
      </PressableCard>
      {suggested ? (
        <View pointerEvents="none" style={[styles.pill, quarter && styles.pillQuarter]}>
          <Text style={[styles.pillText, quarter && styles.pillTextQuarter]}>Suggested</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ActionGrid({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <View style={[styles.grid, compact && styles.gridCompact]}>{children}</View>;
}

const styles = StyleSheet.create({
  quarter: {
    width: '23%',
  },
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
  gridCompact: {
    gap: 8,
    rowGap: ui.space.gap,
  },
  bodyQuarter: {
    minHeight: 96,
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 4,
  },
  iconQuarter: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleQuarter: {
    fontSize: 14,
  },
  subQuarter: {
    fontSize: 11,
    lineHeight: 13,
  },
  pillQuarter: {
    top: -8,
    paddingHorizontal: 6,
  },
  pillTextQuarter: {
    fontSize: 9,
  },
  body: {
    minHeight: 108,
    padding: 12,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    paddingHorizontal: 40,
  },
  suggested: {
    borderWidth: 2,
    borderColor: ui.accent.care.main,
    borderRadius: 20,
  },
  pill: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    zIndex: 2,
    backgroundColor: ui.accent.care.main,
    borderRadius: ui.radius.pill,
    borderWidth: 1.5,
    borderColor: ui.card,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  centered: {
    textAlign: 'center',
  },
  chevron: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
    backgroundColor: ui.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  iconOff: {
    backgroundColor: ui.disabledBg,
  },
  copy: {
    alignItems: 'center',
    gap: 2,
  },
  copyRow: {
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 19,
  },
  sub: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
  },
});
