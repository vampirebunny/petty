import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { helpItems, helpTitle } from '../../cuddle/guidance';
import { minTouch, theme } from '../theme';

type GhostProps = {
  // View coordinates along the pet's back.
  from: { x: number; y: number };
  to: { x: number; y: number };
  reducedMotion: boolean;
  onDone: () => void;
};

// A faint finger that strokes the pet's back once. No text.
export function GhostFinger({ from, to, reducedMotion, onDone }: GhostProps) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reducedMotion ? 600 : 1400, easing: Easing.inOut(Easing.sin) });
    const timer = setTimeout(onDone, reducedMotion ? 700 : 1500);
    return () => clearTimeout(timer);
  }, [onDone, progress, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * Math.sin(Math.PI * progress.value),
    transform: [
      { translateX: reducedMotion ? 0 : (to.x - from.x) * progress.value },
      { translateY: reducedMotion ? 0 : (to.y - from.y) * progress.value },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghost, { left: from.x - 16, top: from.y - 16 }, style]}
    />
  );
}

type HelpProps = { visible: boolean; onClose: () => void };

export function CuddleHelpSheet({ visible, onClose }: HelpProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {helpTitle}
          </Text>
          {helpItems.map((item) => (
            <Text key={item.title} style={styles.sheetItem}>
              <Text style={styles.sheetItemTitle}>{item.title}: </Text>
              {item.text}
            </Text>
          ))}
          <Pressable
            style={styles.sheetClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
          >
            <Text style={styles.cardNextText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    color: theme.accentDark,
    fontSize: 12.5,
  },
  ghost: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: theme.accent,
  },
  coach: {
    backgroundColor: 'rgba(36,48,68,0.45)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  ring: {
    position: 'absolute',
    width: 128,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardStep: {
    fontSize: 12,
    color: theme.muted,
  },
  cardText: {
    fontSize: 16,
    color: theme.ink,
  },
  cardClosing: {
    fontSize: 14,
    color: theme.muted,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  cardButton: {
    minHeight: minTouch,
    minWidth: minTouch,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNext: {
    backgroundColor: theme.accent,
  },
  cardSkip: {
    color: theme.muted,
    fontSize: 15,
  },
  cardNextText: {
    color: theme.accentDark,
    fontSize: 15,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(36,48,68,0.45)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 20,
    color: theme.ink,
  },
  sheetItem: {
    fontSize: 15,
    color: theme.ink,
  },
  sheetItemTitle: {
    fontWeight: '600',
  },
  sheetClose: {
    alignSelf: 'flex-end',
    minHeight: minTouch,
    minWidth: minTouch,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
