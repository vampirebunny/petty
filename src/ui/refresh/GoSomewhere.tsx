import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { placeFlavors, placeIcons } from '../actionIcons';
import { candyInk, tints } from '../candy';
import { fontFamily } from '../font';
import { Gloss } from './Gloss';
import { PressableCard } from './PressableCard';
import { ui } from './tokens';

type Props = {
  petName: string;
  placeId: string;
  placeName: string;
  /** Venues read "at the Arcade"; rooms read "in the Bedroom". */
  at?: boolean;
  onPress: () => void;
  reducedMotion?: boolean;
};

export function GoSomewhere({ petName, placeId, placeName, at = false, onPress, reducedMotion = false }: Props) {
  const where = at ? 'at' : 'in';
  const tint = tints[placeFlavors[placeId] ?? 'peach'];
  const Icon = placeIcons[placeId] ?? placeIcons.livingroom;
  const ink = candyInk(tint);
  return (
    <PressableCard
      tint={tint}
      radius={22}
      reducedMotion={reducedMotion}
      accessibilityLabel={`Go somewhere. ${petName} is ${where} the ${placeName}`}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={[styles.bubble, { shadowColor: tint.lip }]}>
          <Icon size={18} strokeWidth={2.25} color={tint.icon} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.kicker, { color: tint.ink }]} numberOfLines={1}>
            {petName} is {where} the
          </Text>
          <Text style={[styles.place, { color: ink }]} numberOfLines={1}>
            {placeName}
          </Text>
        </View>
        <View style={[styles.pill, { borderBottomColor: tint.lip }]}>
          <Gloss radius={18} />
          <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
            Go somewhere
          </Text>
          <ChevronRight size={16} strokeWidth={2.25} color={ink} />
        </View>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ui.card,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  copy: {
    flex: 1,
  },
  kicker: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 13,
  },
  place: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    lineHeight: 19,
  },
  pill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.card,
    overflow: 'hidden',
    borderBottomWidth: 3,
  },
  pillText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
  },
});
