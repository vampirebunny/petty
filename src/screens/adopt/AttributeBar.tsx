import { StyleSheet, Text, View } from 'react-native';

import type { Range } from '../../sim/types';

type Props = {
  label: string;
  // A potential range, drawn as a filled min to max segment on a 0 to 100 track.
  range?: Range;
  // An exact potential, drawn as a bar from 0 up to the value.
  value?: number;
  highlight?: boolean;
  showNumbers?: boolean;
  // A line drawn across the track, e.g. a pup's starting score.
  start?: number;
  // A dot on the track, e.g. a pup's potential. With a range, the number shown is this value.
  marker?: number;
};

const trackMax = 100;

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, (value / trackMax) * 100))}%`;
}

export function AttributeBar({
  label,
  range,
  value,
  highlight = false,
  showNumbers = false,
  start,
  marker,
}: Props) {
  const from = range ? range[0] : 0;
  const to = range ? range[1] : (value ?? 0);
  const numbers = marker != null ? String(marker) : range ? `${range[0]}-${range[1]}` : String(value ?? 0);
  return (
    <View style={styles.row} accessibilityLabel={`${label} ${numbers}`}>
      <Text style={[styles.label, highlight && styles.strong]}>{label}</Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            highlight ? styles.fillStrong : styles.fillNormal,
            { left: percent(from), width: percent(to - from) },
          ]}
        />
        {start != null ? <View style={[styles.start, { left: percent(start) }]} /> : null}
        {marker != null ? <View style={[styles.marker, { left: percent(marker) }]} /> : null}
      </View>
      <Text style={[styles.number, !showNumbers && styles.hidden, highlight && styles.strong]}>{numbers}</Text>
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
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  start: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#243044',
  },
  marker: {
    position: 'absolute',
    top: 1,
    width: 6,
    height: 6,
    marginLeft: -3,
    borderRadius: 3,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#243044',
  },
  fillNormal: {
    backgroundColor: '#8DA2BD',
  },
  fillStrong: {
    backgroundColor: '#E58A3A',
  },
  number: {
    width: 52,
    fontSize: 13,
    textAlign: 'right',
    color: '#5C6B80',
  },
  hidden: {
    opacity: 0,
  },
});
