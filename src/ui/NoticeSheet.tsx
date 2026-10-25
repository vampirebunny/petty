import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';

type Props = {
  message: string;
  top: number;
  onClose: () => void;
};

export function NoticeSheet({ message, top, onClose }: Props) {
  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.message}>{message}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="OK" onPress={onClose} style={styles.choice}>
          <Text style={styles.label}>OK</Text>
        </Pressable>
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
    zIndex: 40,
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
  message: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: '#6B4C7A',
  },
  choice: {
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
