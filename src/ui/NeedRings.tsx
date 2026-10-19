import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Needs } from '../sim/types';
import { theme } from './theme';

type Props = {
  needs: Needs;
};

const size = 96;
const stroke = 12;
const radius = (size - stroke) / 2;
const circumference = 2 * Math.PI * radius;

function Ring({ label, value, color }: { label: string; value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = (clamped / 100) * circumference;
  return (
    <View style={styles.item} accessible accessibilityLabel={`${label} ${Math.round(clamped)} percent`}>
      <View style={styles.ring}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeOpacity={0.2} strokeWidth={stroke} fill="none" />
          {clamped > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              fill="none"
              // Start at 12 o'clock and fill clockwise.
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <Text style={styles.value}>{Math.round(clamped)}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function NeedRings({ needs }: Props) {
  return (
    <View style={styles.row}>
      <Ring label="Hunger" value={needs.hunger} color="#F2994A" />
      <Ring label="Energy" value={needs.energy} color="#4CC38A" />
      <Ring label="Mood" value={needs.happiness} color="#EB5A8C" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  item: {
    alignItems: 'center',
    gap: 6,
  },
  ring: {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    position: 'absolute',
    fontSize: 22,
    fontWeight: '700',
    color: theme.ink,
  },
  label: {
    fontSize: 14,
    color: theme.muted,
  },
});
