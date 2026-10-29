import { ChevronRight, House } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '../font';
import { iconStroke } from '../theme';
import { PulseScale } from '../SuggestionRow';
import { ink, white } from './gloss';

type Props = {
  onLeave: () => void;
  pulse?: boolean;
  reducedMotion?: boolean;
};

export function LocationPill({ onLeave, pulse = false, reducedMotion = false }: Props) {
  return (
    <PulseScale on={pulse} reducedMotion={reducedMotion}>
    <View style={styles.pill}>
      <View style={styles.house}>
        <House size={18} strokeWidth={iconStroke + 0.4} color="#7A3A0E" />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        Training School
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={onLeave} style={styles.leave}>
        <Text style={styles.leaveText}>Leave</Text>
        <ChevronRight size={16} strokeWidth={iconStroke + 0.4} color={ink} />
      </Pressable>
    </View>
    </PulseScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 8,
    shadowColor: '#2B2F4A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  house: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD5B5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: ink,
  },
  leave: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#F4F6FB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  leaveText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: ink,
  },
});
