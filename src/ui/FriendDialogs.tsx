import { Modal, StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { fontFamily } from './font';
import { theme } from './theme';

type BlockProps = {
  handle: string;
  onBlock: () => void;
  onCancel: () => void;
};

export function BlockConfirm({ handle, onBlock, onCancel }: BlockProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={styles.dim}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text style={styles.title}>Block @{handle}?</Text>
          <Text style={styles.body}>{"They won't be able to find you or send you requests."}</Text>
          <Pressable accessibilityRole="button" onPress={onBlock} style={styles.danger}>
            <Text style={styles.dangerText}>Block</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.quiet}>
            <Text style={styles.quietText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ReportProps = {
  onPick: (reason: 'inappropriate_handle' | 'inappropriate_pet_name' | 'something_else', target: 'handle' | 'pet_name') => void;
  onClose: () => void;
};

export function ReportSheet({ onPick, onClose }: ReportProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.dim}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text style={styles.title}>Report</Text>
          <Pressable accessibilityRole="button" onPress={() => onPick('inappropriate_handle', 'handle')} style={styles.choice}>
            <Text style={styles.choiceText}>Inappropriate handle</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onPick('inappropriate_pet_name', 'pet_name')} style={styles.choice}>
            <Text style={styles.choiceText}>Inappropriate pet name</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onPick('something_else', 'handle')} style={styles.choice}>
            <Text style={styles.choiceText}>Something else</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.quiet}>
            <Text style={styles.quietText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ThanksProps = {
  onBlock: () => void;
  onClose: () => void;
};

export function ReportThanks({ onBlock, onClose }: ThanksProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.dim}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <Text style={styles.title}>{"Thanks, we'll take a look."}</Text>
          <Pressable accessibilityRole="button" onPress={onBlock} style={styles.danger}>
            <Text style={styles.dangerText}>Block</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.quiet}>
            <Text style={styles.quietText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF8F3',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 20,
    color: theme.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
    color: theme.ink,
    textAlign: 'center',
  },
  danger: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#EE5C40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#fff',
  },
  quiet: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: theme.muted,
  },
  choice: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: theme.ink,
  },
});
