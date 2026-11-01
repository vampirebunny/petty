import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Medal } from 'lucide-react-native';

import { candyInk } from '../candy';
import { fontFamily } from '../font';
import { Gloss } from './Gloss';
import { ui } from './tokens';

const candy = ui.candy.train;

type Props = {
  name: string;
  progress: number;
  resting: boolean;
  remainLabel: string;
  onPress: () => void;
  suggested?: boolean;
};

export function TrainingRow({ name, progress, resting, remainLabel, onPress, suggested = false }: Props) {
  const shown = Math.round(Math.max(0, Math.min(100, progress)));
  return (
    <View style={[styles.row, suggested && styles.suggested]}>
      <LinearGradient colors={[candy.top, candy.base, candy.bottom]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Gloss radius={ui.radius.card} />
      <View style={styles.icon}>
        <Medal size={18} color={candy.icon} strokeWidth={2.25} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.percent}>{shown}%</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${shown}%` }]} />
        </View>
      </View>
      {resting ? (
        <View style={styles.rest}>
          <Clock size={14} color={ui.disabledInk} />
          <Text style={styles.restText}>{remainLabel}</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`Train ${name}`} onPress={onPress} style={styles.pillHit}>
          <LinearGradient colors={[ui.trainPill.top, ui.trainPill.bottom]} style={styles.pill}>
            <Gloss radius={18} />
            <Text style={styles.pillText}>Train</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    borderRadius: ui.radius.card,
    padding: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: ui.gloss.top,
    borderBottomWidth: 4,
    borderBottomColor: candy.lip,
  },
  suggested: {
    borderWidth: 2,
    borderColor: ui.accent.care.main,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ui.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: candyInk(candy),
  },
  percent: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: candy.ink,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: ui.card,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: candy.icon,
  },
  pillHit: {
    minWidth: 72,
    minHeight: 44,
    justifyContent: 'center',
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: ui.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: ui.gloss.top,
    borderBottomWidth: 3,
    borderBottomColor: ui.trainPill.edge,
  },
  pillText: {
    color: ui.card,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    textShadowColor: ui.trainPill.edge,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rest: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.disabledBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restText: {
    color: ui.disabledInk,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
  },
});
