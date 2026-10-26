import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from './font';
import { SheetDismiss } from './SheetDismiss';

type Props = {
  message: string;
  top: number;
  onClose: () => void;
};

export function NoticeSheet({ message, top, onClose }: Props) {
  return (
    <SheetDismiss top={top} label="Close" onClose={onClose} zIndex={60}>
      <View style={styles.card}>
        <Text style={styles.message}>{message}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="OK" onPress={onClose} style={styles.choice}>
          <Text style={styles.label}>OK</Text>
        </Pressable>
      </View>
    </SheetDismiss>
  );
}

const styles = StyleSheet.create({
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
