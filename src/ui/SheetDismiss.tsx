import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Props = {
  top: number;
  label: string;
  onClose: () => void;
  zIndex?: number;
  children: ReactNode;
};

// Backdrop for the area around the card. The pet scene stays tappable and closes from its own tap.
export function SheetDismiss({ top, label, onClose, zIndex = 50, children }: Props) {
  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(onClose)();
      }),
    [onClose],
  );
  return (
    <View style={[styles.layer, { top, zIndex }]} pointerEvents="box-none">
      <GestureDetector gesture={tap}>
        <View accessible accessibilityRole="button" accessibilityLabel={label} collapsable={false} style={styles.dim} />
      </GestureDetector>
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
    maxHeight: '100%',
    paddingHorizontal: 20,
  },
});
