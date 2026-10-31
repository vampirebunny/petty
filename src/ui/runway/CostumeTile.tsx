import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';

import { costumeRackImages } from '../../runway/costumeRackImages';
import { fontFamily } from '../font';

type Props = {
  id: string;
  label: string;
  worn: boolean;
  locked?: boolean;
  countdownLabel?: string | null;
  taken?: boolean;
  onPress: () => void;
};

function CostumeTileInner({ id, label, worn, locked, countdownLabel, taken, onPress }: Props) {
  const source = costumeRackImages[id];
  const disabled = Boolean(locked || taken);

  return (
    <View style={[styles.wrap, (locked || taken) && styles.dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? `${label}, locked${countdownLabel ? `, unlocks ${countdownLabel}` : ''}`
            : taken
              ? `${label}, taken`
              : worn
                ? `${label}, wearing`
                : label
        }
        accessibilityState={{ selected: worn, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={[styles.tile, worn && styles.worn]}
      >
        {worn ? (
          <View style={styles.badge}>
            <Check color="#FFFFFF" size={12} strokeWidth={4} />
          </View>
        ) : null}
        {locked ? (
          <View style={styles.lockBadge}>
            <Lock color="#F4F1EA" size={12} strokeWidth={3} />
          </View>
        ) : null}
        {source ? (
          <Image source={source} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.art} />
        )}
        <Text numberOfLines={2} style={[styles.label, worn && styles.wornLabel]}>
          {label}
        </Text>
        {locked && countdownLabel ? <Text style={styles.countdown}>{countdownLabel}</Text> : null}
        {taken ? <Text style={styles.taken}>Taken</Text> : null}
      </Pressable>
    </View>
  );
}

export const CostumeTile = memo(CostumeTileInner, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.label === next.label &&
    prev.worn === next.worn &&
    prev.locked === next.locked &&
    prev.countdownLabel === next.countdownLabel &&
    prev.taken === next.taken &&
    prev.onPress === next.onPress
  );
});

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.5 },
  tile: {
    backgroundColor: '#48484E',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
    minHeight: 108,
  },
  worn: {
    backgroundColor: '#5A4A7A',
  },
  art: { width: 56, height: 56 },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7FD3A0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2C2C30',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  label: {
    fontFamily: fontFamily.regular,
    color: '#F4F1EA',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 13,
  },
  wornLabel: { fontFamily: fontFamily.fredokaSemibold },
  countdown: {
    fontFamily: fontFamily.fredokaSemibold,
    color: '#C9B6FF',
    fontSize: 10,
    textAlign: 'center',
  },
  taken: {
    fontFamily: fontFamily.fredokaSemibold,
    color: '#FFAD7A',
    fontSize: 10,
    textAlign: 'center',
  },
});
