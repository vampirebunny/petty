import { Modal, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { rememberFriendPromptDecline } from '../friends/prompt';
import { requestFriendPermission } from '../friends/push';
import { fontFamily } from './font';
import { theme } from './theme';

type Props = {
  onClose: () => void;
};

export function FriendNotifyPrompt({ onClose }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Text style={styles.title}>Want to know when friends send requests?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void requestFriendPermission().finally(onClose);
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Turn on</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void rememberFriendPromptDecline().finally(onClose);
            }}
            style={styles.quiet}
          >
            <Text style={styles.quietText}>Not now</Text>
          </Pressable>
        </View>
      </View>
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
    paddingVertical: 22,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    lineHeight: 28,
    color: theme.ink,
    textAlign: 'center',
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#7853E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
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
});
