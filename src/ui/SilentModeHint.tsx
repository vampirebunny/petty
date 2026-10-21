import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { minTouch, theme } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Same sheet as the cuddle help modal: dim backdrop, white card, accent button.
export function SilentModeHint({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Can&apos;t hear anything?
          </Text>
          <Text style={styles.sheetItem}>
            If your iPhone is on silent, sounds are off. Turn off silent mode to hear them.
          </Text>
          <Pressable
            style={styles.sheetClose}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  buttonText: {
    color: theme.accentDark,
    fontSize: 15,
  },
});
