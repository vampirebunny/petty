import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

type Props = {
  warning: string | null;
  confirming: boolean;
  onStore: () => void;
  onMove: () => void;
  onKeep: () => void;
  onClose: () => void;
};

export function HoldPieceSheet({ warning, confirming, onStore, onMove, onKeep, onClose }: Props) {
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.card}>
        {confirming && warning ? <Text style={styles.warning}>{warning}</Text> : <Text style={styles.title}>This piece</Text>}
        {confirming ? (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="Put away" onPress={onStore} style={styles.choice}>
              <Text style={styles.label}>Put away</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Keep" onPress={onKeep} style={styles.choice}>
              <Text style={styles.label}>Keep</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="Put in storage" onPress={onStore} style={styles.choice}>
              <Text style={styles.label}>Put in storage</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Move" onPress={onMove} style={styles.choice}>
              <Text style={styles.label}>Move</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36, 48, 68, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF6FB',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: '#6B4C7A',
  },
  warning: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: '#6B4C7A',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choice: {
    minWidth: 88,
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFE4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#6B4C7A',
    textAlign: 'center',
  },
});
