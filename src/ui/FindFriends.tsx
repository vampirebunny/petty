import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { X } from 'lucide-react-native';

import { lookupHandle, cancelFriendRequest, respondFriendRequest, sendFriendRequest, notifyFriendRequest } from '../friends/api';
import { friendErrorCopy, relationAction } from '../friends/rules';
import type { LookupResult } from '../friends/types';
import { CandyShell, candyInk, tints } from './candy';
import { fontFamily } from './font';
import { FriendFace } from './FriendFace';
import { iconStroke, theme } from './theme';

type Props = {
  onClose: () => void;
  onChanged: () => void;
  onSent: () => void;
  onAccepted: () => void;
  onReport: (userId: string, handle: string) => void;
};

export function FindFriends({ onClose, onChanged, onSent, onAccepted, onReport }: Props) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const search = () => {
    const handle = query.trim();
    if (!handle || busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void lookupHandle(handle).then((next) => {
      setBusy(false);
      setResult(next);
      if (!next.ok) {
        setNote(friendErrorCopy(next.error));
      } else if (!next.found) {
        setNote('No player found with that handle.');
      }
    });
  };

  const found = result && result.ok && result.found ? result : null;
  const action = found ? relationAction(found.state) : null;

  const run = (kind: 'send' | 'accept' | 'cancel') => {
    if (!found || busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void (async () => {
      if (kind === 'send') {
        const sent = await sendFriendRequest(found.handle);
        setBusy(false);
        if (!sent.ok) {
          setNote(friendErrorCopy(sent.error));
          return;
        }
        if (sent.state === 'pending' && sent.requestId) {
          void notifyFriendRequest(sent.requestId);
          setNote('Request sent!');
          onSent();
        } else {
          setNote('You are friends now.');
          onAccepted();
        }
        onChanged();
        const again = await lookupHandle(found.handle);
        setResult(again);
        return;
      }
      if (kind === 'accept' && found.requestId) {
        const accepted = await respondFriendRequest(found.requestId, 'accept');
        setBusy(false);
        if (!accepted.ok) {
          setNote(friendErrorCopy(accepted.error));
          return;
        }
        setNote('You are friends now.');
        onAccepted();
        onChanged();
        setResult(await lookupHandle(found.handle));
        return;
      }
      if (kind === 'cancel' && found.requestId) {
        const canceled = await cancelFriendRequest(found.requestId);
        setBusy(false);
        if (!canceled.ok) {
          setNote(friendErrorCopy(canceled.error));
          return;
        }
        onChanged();
        setResult(await lookupHandle(found.handle));
        return;
      }
      setBusy(false);
    })();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dim}>
        <CandyShell tint={tints.lilac} radius={28} uid="find-friends" style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Find friends</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <X color={candyInk(tints.lilac)} size={20} strokeWidth={iconStroke} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter a friend's handle"
            placeholderTextColor={theme.muted}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={search} style={styles.primary}>
            <Text style={styles.primaryText}>{busy ? 'Looking…' : 'Search'}</Text>
          </Pressable>
          {busy ? <ActivityIndicator color={tints.lilac.icon} /> : null}
          {found ? (
            <View style={styles.result}>
              <FriendFace userId={found.userId} pet={found.pet} />
              <View style={styles.copy}>
                <Text style={styles.handle}>@{found.handle}</Text>
                <Text style={styles.meta}>{found.pet?.name ?? 'No pet yet'}</Text>
              </View>
            </View>
          ) : null}
          {found && action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: action.disabled || busy }}
              disabled={action.disabled || busy}
              onPress={() => {
                if (action.action === 'send') {
                  run('send');
                } else if (action.action === 'accept') {
                  run('accept');
                }
              }}
              style={[styles.primary, action.disabled && styles.disabled]}
            >
              <Text style={styles.primaryText}>{action.label}</Text>
            </Pressable>
          ) : null}
          {found && action?.cancel && found.requestId ? (
            <Pressable accessibilityRole="button" onPress={() => run('cancel')} style={styles.secondary}>
              <Text style={styles.secondaryText}>Cancel request</Text>
            </Pressable>
          ) : null}
          {found ? (
            <Pressable accessibilityRole="button" onPress={() => onReport(found.userId, found.handle)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Report</Text>
            </Pressable>
          ) : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </CandyShell>
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
    maxWidth: 380,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
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
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: tints.lilac.lip,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    color: theme.ink,
    backgroundColor: '#fff',
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: tints.lilac.icon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: candyInk(tints.lilac),
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  handle: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: theme.ink,
  },
  meta: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: theme.muted,
  },
  note: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
    color: theme.ink,
    textAlign: 'center',
  },
});
