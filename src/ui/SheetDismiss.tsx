import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  top: number;
  label: string;
  onClose: () => void;
  zIndex?: number;
  children: ReactNode;
};

// Backdrop for the area around the card. The pet scene stays tappable and closes from its own tap.
// A native tap on this layer was winning over the tiles, so a press on a bowl closed the sheet
// without choosing it. The card sits above this pressable and takes its own taps.
export function SheetDismiss({ top, label, onClose, zIndex = 50, children }: Props) {
  return (
    <View style={[styles.layer, { top, zIndex }]} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onClose} style={styles.dim} />
      <View pointerEvents="box-none" style={styles.dock}>
        {children}
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
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  dock: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    maxHeight: '100%',
    paddingHorizontal: 20,
    // Keeps a tall card above the home indicator so its last row can scroll on screen.
    paddingBottom: 28,
    zIndex: 2,
    elevation: 8,
  },
});
