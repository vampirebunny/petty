import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronLeft } from 'lucide-react-native';

import {
  blockPlayer,
  cancelFriendRequest,
  lookupHandle,
  notifyFriendRequest,
  reportPlayer,
  respondFriendRequest,
  sendFriendRequest,
} from '../friends/api';
import { friendErrorCopy, isOwnHandle, relationAction } from '../friends/rules';
import type { LookupResult } from '../friends/types';
import { CandyShell, candyInk, tints } from './candy';
import { BlockConfirm, ReportSheet, ReportThanks } from './FriendDialogs';
import { FriendFace } from './FriendFace';
import { fontFamily } from './font';
import { iconStroke, theme } from './theme';

type Props = {
  accountHandle: string | null;
  initialHandle?: string | null;
  onClose: () => void;
  onChanged: () => void;
  onSent: () => void;
  onAccepted: () => void;
  onScan: () => void;
};

export function FindFriends({ accountHandle, initialHandle, onClose, onChanged, onSent, onAccepted, onScan }: Props) {
  const [query, setQuery] = useState(initialHandle ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [reportUser, setReportUser] = useState<{ userId: string; handle: string } | null>(null);
  const [thanks, setThanks] = useState<{ userId: string; handle: string } | null>(null);
  const [block, setBlock] = useState<{ userId: string; handle: string } | null>(null);

  const searchHandle = (handle: string) => {
    const cleaned = handle.trim();
    if (!cleaned || busy) {
      return;
    }
    setNote(null);
    setResult(null);
    if (isOwnHandle(cleaned, accountHandle)) {
      setNote("That's you!");
      return;
    }
    setBusy(true);
    void lookupHandle(cleaned).then((next) => {
      setBusy(false);
      setResult(next);
      if (!next.ok) {
        setNote(friendErrorCopy(next.error));
      } else if (!next.found) {
        setNote('No player found with that handle.');
      }
    });
  };

  useEffect(() => {
    if (!initialHandle) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const cleaned = initialHandle.trim();
      if (!cleaned) {
        return;
      }
      if (isOwnHandle(cleaned, accountHandle)) {
        if (!cancelled) {
          setNote("That's you!");
        }
        return;
      }
      if (!cancelled) {
        setBusy(true);
      }
      const next = await lookupHandle(cleaned);
      if (cancelled) {
        return;
      }
      setBusy(false);
      setResult(next);
      if (!next.ok) {
        setNote(friendErrorCopy(next.error));
      } else if (!next.found) {
        setNote('No player found with that handle.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Prefill runs once when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const found = result && result.ok && result.found ? result : null;
  const action = found ? relationAction(found.state) : null;

  const run = (kind: 'send' | 'accept' | 'decline' | 'cancel') => {
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
      if ((kind === 'accept' || kind === 'decline') && found.requestId) {
        const responded = await respondFriendRequest(found.requestId, kind);
        setBusy(false);
        if (!responded.ok) {
          setNote(friendErrorCopy(responded.error));
          return;
        }
        if (kind === 'accept') {
          setNote('You are friends now.');
          onAccepted();
        }
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="find-back" pressed={pressed} style={styles.back}>
              <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
            </CandyShell>
          )}
        </Pressable>
        <Text style={styles.title}>Find friends</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Enter a friend's handle"
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => searchHandle(query)} style={styles.primary}>
            <Text style={styles.primaryText}>{busy ? 'Looking…' : 'Search'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Scan a code" onPress={onScan} style={styles.scan}>
            <Text style={styles.scanText}>Scan</Text>
          </Pressable>
        </View>
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
            style={[styles.primaryWide, action.disabled && styles.disabled]}
          >
            <Text style={styles.primaryText}>{action.label}</Text>
          </Pressable>
        ) : null}
        {found && action?.action === 'accept' && found.requestId ? (
          <Pressable accessibilityRole="button" onPress={() => run('decline')} style={styles.secondary}>
            <Text style={styles.secondaryText}>Decline</Text>
          </Pressable>
        ) : null}
        {found && action?.cancel && found.requestId ? (
          <Pressable accessibilityRole="button" onPress={() => run('cancel')} style={styles.secondary}>
            <Text style={styles.secondaryText}>Cancel request</Text>
          </Pressable>
        ) : null}
        {found ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setReportUser({ userId: found.userId, handle: found.handle })}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Report</Text>
          </Pressable>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
      {reportUser ? (
        <ReportSheet
          onClose={() => setReportUser(null)}
          onPick={(reason, target) => {
            const person = reportUser;
            setReportUser(null);
            void reportPlayer(person.userId, target, reason).then((reported) => {
              if (!reported.ok) {
                setNote(friendErrorCopy(reported.error, 'report'));
                return;
              }
              setThanks(person);
            });
          }}
        />
      ) : null}
      {thanks ? (
        <ReportThanks
          onClose={() => setThanks(null)}
          onBlock={() => {
            setBlock(thanks);
            setThanks(null);
          }}
        />
      ) : null}
      {block ? (
        <BlockConfirm
          handle={block.handle}
          onCancel={() => setBlock(null)}
          onBlock={() => {
            const person = block;
            setBlock(null);
            void blockPlayer(person.userId).then(() => onChanged());
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F1EA',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: theme.ink,
  },
  body: {
    padding: 20,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
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
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: tints.lilac.icon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryWide: {
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
  scan: {
    minHeight: 48,
    minWidth: 88,
    borderRadius: 24,
    backgroundColor: tints.sky.icon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scanText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#fff',
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
