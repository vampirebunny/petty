import { StyleSheet, Text, View } from 'react-native';

import type { Range } from '../../sim/types';

type Props = {
  label: string;
  // A potential range, drawn as a filled min to max segment on a 0 to 100 track.
  range?: Range;
  // An exact potential, drawn as a bar from 0 up to the value.
  value?: number;
  // With `value` as the potential, a current score drawn as a darker layer on top, shown as "current / potential".
  current?: number;
  // A gain over the other offers, shown as +N next to the value. Hidden unless above 0.
  delta?: number;
  highlight?: boolean;
  showNumbers?: boolean;
};

const trackMax = 100;

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, (value / trackMax) * 100))}%`;
}

export function AttributeBar({
  label,
  range,
  value,
  current,
  delta,
  highlight = false,
  showNumbers = false,
}: Props) {
  const layered = current != null && value != null;
  const from = range ? range[0] : 0;
  const to = range ? range[1] : (value ?? 0);
  const numbers = range ? `${range[0]}-${range[1]}` : String(value ?? 0);
  const gain = delta != null && delta > 0 ? delta : 0;
  const description = layered ? `${label} ${current} of ${value}` : `${label} ${numbers}${gain ? `, plus ${gain}` : ''}`;
  return (
    <View style={styles.row} accessibilityLabel={description}>
      <Text style={[styles.label, highlight && styles.strong]}>{label}</Text>
      <View style={[styles.track, layered && styles.trackLayered]}>
        <View
          style={[
            styles.fill,
            layered ? styles.fillPotential : highlight ? styles.fillStrong : styles.fillNormal,
            { left: percent(from), width: percent(to - from) },
          ]}
        />
        {layered ? (
          <View style={[styles.fill, styles.fillCurrent, { left: 0, width: percent(current) }]} />
        ) : null}
      </View>
      {layered ? (
        <Text style={styles.numberWide}>
          <Text style={styles.strong}>{current}</Text>
          <Text> / {value}</Text>
        </Text>
      ) : (
        <Text style={[styles.number, !showNumbers && styles.hidden, highlight && styles.strong]}>{numbers}</Text>
      )}
      {delta != null ? (
        <Text style={[styles.delta, gain === 0 && styles.hidden]}>{gain ? `+${gain}` : '+0'}</Text>
      ) : null}
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
    width: 86,
    fontSize: 13,
    color: '#5C6B80',
  },
  strong: {
    color: '#243044',
    fontWeight: '600',
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E3E9F1',
    overflow: 'hidden',
  },
  trackLayered: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EDF1F6',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  fillNormal: {
    backgroundColor: '#8DA2BD',
  },
  fillStrong: {
    backgroundColor: '#E58A3A',
  },
  fillPotential: {
    backgroundColor: '#C9D5E4',
  },
  fillCurrent: {
    backgroundColor: '#243044',
  },
  number: {
    width: 52,
    fontSize: 13,
    textAlign: 'right',
    color: '#5C6B80',
  },
  numberWide: {
    width: 64,
    fontSize: 13,
    textAlign: 'right',
    color: '#5C6B80',
  },
  delta: {
    width: 30,
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
    color: '#B8631F',
  },
  hidden: {
    opacity: 0,
  },
});
