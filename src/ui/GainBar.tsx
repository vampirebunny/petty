import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  // The shown score before, what was added, and the cap for this pet.
  before: number;
  gain: number;
  potential: number;
};

const trackMax = 100;

export const gainColors = {
  before: '#243044',
  gain: '#4FC98A',
  potential: '#C9D5E4',
};

export function formatScore(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, (value / trackMax) * 100))}%`;
}

// One attribute: the score before in the app's dark color, what the playdate added in green right after it,
// and the cap as a pale bar behind. The numbers repeat what the bar shows.
export function GainBar({ label, before, gain, potential }: Props) {
  const after = before + gain;
  const added = gain >= 0.05 ? `+${formatScore(gain)}` : '+0';
  return (
    <View
      style={styles.row}
      accessibilityLabel={`${label} ${formatScore(before)} to ${formatScore(after)} of ${formatScore(potential)}, plus ${formatScore(gain)}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { left: 0, width: percent(potential), backgroundColor: gainColors.potential }]} />
        <View style={[styles.fill, { left: 0, width: percent(before), backgroundColor: gainColors.before }]} />
        <View
          style={[styles.fill, { left: percent(before), width: percent(gain), backgroundColor: gainColors.gain }]}
        />
      </View>
      <View style={styles.numbers}>
        <Text style={styles.total}>
          {formatScore(after)}
          <Text style={styles.cap}> / {formatScore(potential)}</Text>
        </Text>
        <Text style={[styles.added, gain < 0.05 && styles.addedNone]}>{added}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 92,
    fontSize: 14,
    color: '#5C6B80',
  },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EDF1F6',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  numbers: {
    width: 84,
    alignItems: 'flex-end',
  },
  total: {
    fontSize: 14,
    fontWeight: '600',
    color: '#243044',
  },
  cap: {
    fontWeight: '400',
    color: '#5C6B80',
  },
  added: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14503A',
  },
  addedNone: {
    color: '#5C6B80',
    fontWeight: '400',
  },
});
