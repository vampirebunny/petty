import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';

import { respondFriendRequest } from '../friends/api';
import type { FriendRow } from '../friends/types';
import { FriendFace } from './FriendFace';
import { fontFamily } from './font';
import { iconStroke, theme } from './theme';

type Props = {
  rows: FriendRow[];
  onClose: () => void;
  onChanged: () => void;
  onAccepted: () => void;
  onReport: (userId: string, handle: string) => void;
  onBlock: (userId: string, handle: string) => void;
};

export function FriendRequestModal({ rows, onClose, onChanged, onAccepted, onReport, onBlock }: Props) {
  const run = (id: string, action: 'accept' | 'decline') => {
    void respondFriendRequest(id, action).then((result) => {
      if (!result.ok) {
        return;
      }
      if (action === 'accept') {
        onAccepted();
      }
      onChanged();
    });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onClose} style={styles.dim}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Friend requests</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
              <X color={theme.ink} size={20} strokeWidth={iconStroke} />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {rows.map((row) => (
              <View key={row.requestId ?? row.userId} style={styles.row}>
                <FriendFace userId={row.userId} pet={row.pet} />
                <View style={styles.copy}>
                  <Text style={styles.handle}>@{row.handle}</Text>
                  <Text style={styles.meta}>{row.pet?.name ?? 'No pet yet'}</Text>
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" onPress={() => row.requestId && run(row.requestId, 'accept')}>
                      <Text style={styles.link}>Accept</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => row.requestId && run(row.requestId, 'decline')}>
                      <Text style={styles.link}>Decline</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onBlock(row.userId, row.handle)}>
                      <Text style={styles.link}>Block</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onReport(row.userId, row.handle)}>
                      <Text style={styles.link}>Report</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
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
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#FFF8F3',
    borderRadius: 28,
    padding: 16,
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: theme.ink,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  handle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: theme.ink,
  },
  meta: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: theme.muted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  link: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
    color: '#35207A',
  },
});
