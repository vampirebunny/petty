import { Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouch, theme } from './theme';

type Props = {
  potty: boolean;
  pottyLabel: string;
  onPotty: () => void;
  cleanCount: number;
  onClean: () => void;
  houseProgress: number | null;
};

export function CareChips({ potty, pottyLabel, onPotty, cleanCount, onClean, houseProgress }: Props) {
  if (!potty && cleanCount <= 0 && houseProgress == null) {
    return null;
  }
  return (
    <View style={styles.row}>
      {houseProgress != null ? (
        <View style={styles.chip} accessibilityLabel={`House Training ${Math.round(houseProgress)} percent`}>
          <Text style={styles.label}>House</Text>
          <Text style={styles.value}>{Math.round(houseProgress)}</Text>
        </View>
      ) : null}
      {potty ? (
        <Pressable style={styles.chip} onPress={onPotty} accessibilityRole="button" accessibilityLabel={pottyLabel}>
          <Text style={styles.label}>{pottyLabel}</Text>
        </Pressable>
      ) : null}
      {cleanCount > 0 ? (
        <Pressable style={styles.chip} onPress={onClean} accessibilityRole="button" accessibilityLabel={`Clean ${cleanCount}`}>
          <Text style={styles.label}>Clean {cleanCount}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    minWidth: minTouch,
    minHeight: minTouch,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '800',
  },
});
