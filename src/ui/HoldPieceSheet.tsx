import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

type Props = {
  top: number;
  warning: string | null;
  confirming: boolean;
  onStore: () => void;
  onMove: () => void;
  onKeep: () => void;
  onClose: () => void;
};

export function HoldPieceSheet({ top, warning, confirming, onStore, onMove, onKeep, onClose }: Props) {
  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
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
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 20,
  },
  dim: {
    ...StyleSheet.absoluteFill,
  },
  card: {
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
