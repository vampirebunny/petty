import { StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronRight, MapPin } from 'lucide-react-native';

import { fontFamily } from '../font';
import { ui } from './tokens';

type Props = {
  place: string;
  onPress: () => void;
};

export function LocationChip({ place, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Go somewhere. ${place}`}
      onPress={onPress}
      style={styles.chip}
    >
      <MapPin size={16} color={ui.ink} strokeWidth={2} />
      <Text style={styles.label} numberOfLines={1}>
        {place}
      </Text>
      <ChevronRight size={16} color={ui.inkMuted} />
    </Pressable>
  );
}

export function locationChipStyle() {
  return styles.float;
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    maxWidth: 220,
    paddingHorizontal: 12,
    borderRadius: ui.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  label: {
    flexShrink: 1,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: ui.ink,
  },
});
