import { StyleSheet, Text, View } from 'react-native';

import type { Needs } from '../sim/types';

type Props = {
  needs: Needs;
};

function Bar({ label, value }: { label: string; value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label} {Math.round(value)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${width}%` }]} />
      </View>
    </View>
  );
}

export function NeedBars({ needs }: Props) {
  return (
    <View style={styles.bars}>
      <Bar label="Hunger" value={needs.hunger} />
      <Bar label="Energy" value={needs.energy} />
      <Bar label="Mood" value={needs.happiness} />
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    gap: 10,
  },
  row: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    color: '#243044',
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E4E8EF',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#7CB8E8',
  },
});
