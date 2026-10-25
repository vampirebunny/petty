import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { ChevronLeft } from 'lucide-react-native';

import {
  blockPlayer,
  cancelFriendRequest,
  loadFriends,
  readFriendNotifications,
  removeFriend,
  reportPlayer,
  respondFriendRequest,
  unblockPlayer,
  writeFriendNotifications,
} from '../friends/api';
import { findFriendsSnapshot, onFindFriends, openFindFriends, openFriendScanner } from '../friends/findOpen';
import { friendPromptShouldShow } from '../friends/prompt';
import { friendErrorCopy, inviteShareMessage } from '../friends/rules';
import type { FriendRow } from '../friends/types';
import { setSuppressOpenPath } from '../state/sessionGate';
import { CandyShell, candyInk, tints } from './candy';
import { MyCode } from './MyCode';
import { BlockConfirm, ReportSheet, ReportThanks } from './FriendDialogs';
import { FriendFace } from './FriendFace';
import { FriendNotifyPrompt } from './FriendNotifyPrompt';
import { fontFamily } from './font';
import { iconStroke, theme } from './theme';

type Props = {
  handle: string | null;
  careRemindersOn: boolean;
  onCareReminders: (enabled: boolean) => void;
  onClose: () => void;
  onChanged: () => void;
  onPickHandle: () => void;
};

type Person = { userId: string; handle: string };

export function FriendsManage({ handle, careRemindersOn, onCareReminders, onClose, onChanged, onPickHandle }: Props) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [sent, setSent] = useState<FriendRow[]>([]);
  const [blocked, setBlocked] = useState<FriendRow[]>([]);
  const [offline, setOffline] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [menu, setMenu] = useState<Person | null>(null);
  const [reportUser, setReportUser] = useState<Person | null>(null);
  const [thanks, setThanks] = useState<Person | null>(null);
  const [block, setBlock] = useState<Person | null>(null);
  const [friendNotes, setFriendNotes] = useState(true);
  const [permission, setPermission] = useState<string>('undetermined');
  const [promptOpen, setPromptOpen] = useState(false);

  const refresh = () => {
    void loadFriends().then((bundle) => {
      setFriends(bundle.friends);
      setIncoming(bundle.incoming);
      setSent(bundle.sent);
      setBlocked(bundle.blocked);
      setOffline(bundle.offline);
      if (bundle.error && bundle.error !== 'offline' && bundle.error !== 'account_required') {
        setNote(friendErrorCopy(bundle.error));
      }
      onChanged();
    });
  };

  useEffect(() => {
    let cancelled = false;
    void loadFriends().then((bundle) => {
      if (cancelled) {
        return;
      }
      setFriends(bundle.friends);
      setIncoming(bundle.incoming);
      setSent(bundle.sent);
      setBlocked(bundle.blocked);
      setOffline(bundle.offline);
    });
    void readFriendNotifications().then((enabled) => {
      if (!cancelled) {
        setFriendNotes(enabled);
      }
    });
    void Notifications.getPermissionsAsync().then((current) => {
      if (!cancelled) {
        setPermission(current.status);
      }
    });
    void friendPromptShouldShow('settings').then((show) => {
      if (!cancelled && show) {
        setPromptOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    return onFindFriends(() => {
      const snap = findFriendsSnapshot();
      if (!snap.open && !snap.scanning) {
        refreshRef.current();
      }
    });
  }, []);

  const share = () => {
    setSuppressOpenPath(true);
    void Share.share({ message: inviteShareMessage(handle) }).finally(() => setSuppressOpenPath(false));
  };

  const act = (work: Promise<{ ok: boolean; error?: string }>) => {
    if (offline) {
      setNote("You'll need internet for that.");
      return;
    }
    void work.then((result) => {
      if (!result.ok && result.error) {
        setNote(friendErrorCopy(result.error));
        return;
      }
      setNote(null);
      refresh();
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="friends-back" pressed={pressed} style={styles.back}>
              <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
            </CandyShell>
          )}
        </Pressable>
        <Text style={styles.title}>Friends</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {offline ? <Text style={styles.note}>Offline</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => openFindFriends()} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.lilac} radius={22} uid="settings-find" pressed={pressed} style={styles.button}>
              <Text style={[styles.buttonText, { color: candyInk(tints.lilac) }]}>Find friends</Text>
            </CandyShell>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!handle) {
              onPickHandle();
              return;
            }
            setCodeOpen(true);
          }}
          style={styles.hit}
        >
          {({ pressed }) => (
            <CandyShell tint={tints.mint} radius={22} uid="settings-code" pressed={pressed} style={styles.button}>
              <Text style={[styles.buttonText, { color: candyInk(tints.mint) }]}>My code</Text>
            </CandyShell>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Invite a friend to Boop Boop" onPress={share} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="settings-invite" pressed={pressed} style={styles.invite}>
              <Text style={[styles.buttonText, { color: candyInk(tints.sky) }]}>Invite a friend to Boop Boop</Text>
              <Text style={styles.sub}>Share the app so your pets can play together.</Text>
            </CandyShell>
          )}
        </Pressable>
        {permission === 'denied' ? (
          <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.hit}>
            <Text style={styles.link}>Notifications are off. Open system settings.</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: friendNotes }}
          onPress={() => {
            const next = !friendNotes;
            setFriendNotes(next);
            void writeFriendNotifications(next);
          }}
          style={styles.switchRow}
        >
          <Text style={styles.section}>Friend requests</Text>
          <Text style={styles.meta}>{friendNotes ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: careRemindersOn }}
          onPress={() => onCareReminders(!careRemindersOn)}
          style={styles.switchRow}
        >
          <Text style={styles.section}>Care reminders</Text>
          <Text style={styles.meta}>{careRemindersOn ? 'On' : 'Off'}</Text>
        </Pressable>
        <Text style={styles.section}>Requests</Text>
        {incoming.length === 0 ? <Text style={styles.meta}>No requests right now.</Text> : null}
        {incoming.map((row) => (
          <View key={row.requestId} style={styles.card}>
            <FriendFace userId={row.userId} pet={row.pet} />
            <View style={styles.copy}>
              <Text style={styles.handle}>@{row.handle}</Text>
              <Text style={styles.meta}>{row.pet?.name ?? 'No pet yet'}</Text>
              <View style={styles.actions}>
                <TextButton label="Accept" onPress={() => row.requestId && act(respondFriendRequest(row.requestId, 'accept'))} />
                <TextButton label="Decline" onPress={() => row.requestId && act(respondFriendRequest(row.requestId, 'decline'))} />
                <TextButton label="Block" onPress={() => setBlock({ userId: row.userId, handle: row.handle })} />
                <TextButton label="Report" onPress={() => setReportUser({ userId: row.userId, handle: row.handle })} />
              </View>
            </View>
          </View>
        ))}
        <Text style={styles.section}>Sent</Text>
        {sent.length === 0 ? <Text style={styles.meta}>No requests right now.</Text> : null}
        {sent.map((row) => (
          <View key={row.requestId} style={styles.card}>
            <FriendFace userId={row.userId} pet={row.pet} />
            <View style={styles.copy}>
              <Text style={styles.handle}>@{row.handle}</Text>
              <TextButton label="Cancel" onPress={() => row.requestId && act(cancelFriendRequest(row.requestId))} />
            </View>
          </View>
        ))}
        <Text style={styles.section}>Friends</Text>
        {friends.length === 0 ? <Text style={styles.meta}>No friends yet.</Text> : null}
        {friends.map((row) => (
          <View key={row.userId} style={styles.card}>
            <FriendFace userId={row.userId} pet={row.pet} />
            <View style={styles.copy}>
              <Text style={styles.handle}>@{row.handle}</Text>
              <Text style={styles.meta}>{row.pet?.name ?? 'No pet yet'}</Text>
              <TextButton label="Options" onPress={() => setMenu({ userId: row.userId, handle: row.handle })} />
            </View>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={() => setBlockedOpen(true)} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.peach} radius={22} uid="settings-blocked" pressed={pressed} style={styles.button}>
              <Text style={[styles.buttonText, { color: candyInk(tints.peach) }]}>Blocked list</Text>
            </CandyShell>
          )}
        </Pressable>
      </ScrollView>
      {blockedOpen ? (
        <View style={styles.blocked}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setBlockedOpen(false)} style={styles.backHit}>
              {({ pressed }) => (
                <CandyShell tint={tints.sky} radius={22} uid="blocked-back" pressed={pressed} style={styles.back}>
                  <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
                </CandyShell>
              )}
            </Pressable>
            <Text style={styles.title}>Blocked</Text>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {blocked.length === 0 ? <Text style={styles.meta}>{"You haven't blocked anyone."}</Text> : null}
            {blocked.map((row) => (
              <View key={row.userId} style={styles.switchRow}>
                <Text style={styles.handle}>@{row.handle}</Text>
                <TextButton label="Unblock" onPress={() => act(unblockPlayer(row.userId))} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {codeOpen && handle ? (
        <View style={styles.blocked}>
          <MyCode handle={handle} onClose={() => setCodeOpen(false)} onScan={() => openFriendScanner('code')} />
        </View>
      ) : null}
      {menu ? (
        <View style={styles.menuLayer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setMenu(null)} style={styles.menuDim} />
          <View style={styles.menuCard}>
            <TextButton label="Remove friend" onPress={() => { const person = menu; setMenu(null); act(removeFriend(person.userId)); }} />
            <TextButton label="Block" onPress={() => { setBlock(menu); setMenu(null); }} />
            <TextButton label="Report" onPress={() => { setReportUser(menu); setMenu(null); }} />
          </View>
        </View>
      ) : null}
      {reportUser ? (
        <ReportSheet
          onClose={() => setReportUser(null)}
          onPick={(reason, target) => {
            const person = reportUser;
            setReportUser(null);
            void reportPlayer(person.userId, target, reason).then((result) => {
              if (!result.ok) {
                setNote(friendErrorCopy(result.error, 'report'));
                return;
              }
              setThanks(person);
            });
          }}
        />
      ) : null}
      {thanks ? (
        <ReportThanks onClose={() => setThanks(null)} onBlock={() => { setBlock(thanks); setThanks(null); }} />
      ) : null}
      {block ? (
        <BlockConfirm
          handle={block.handle}
          onCancel={() => setBlock(null)}
          onBlock={() => {
            const person = block;
            setBlock(null);
            act(blockPlayer(person.userId));
          }}
        />
      ) : null}
      {promptOpen ? <FriendNotifyPrompt onClose={() => setPromptOpen(false)} /> : null}
    </View>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.textHit}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F1EA',
    paddingTop: 64,
  },
  blocked: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    paddingBottom: 40,
  },
  hit: {
    alignSelf: 'stretch',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  invite: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  buttonText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: theme.muted,
    textAlign: 'center',
  },
  section: {
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
    color: theme.ink,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: '#fffaf4',
    borderRadius: 18,
    padding: 8,
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textHit: {
    minHeight: 36,
    justifyContent: 'center',
  },
  link: {
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    color: candyInk(tints.periwinkle),
  },
  menuLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  menuDim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
  },
  menuCard: {
    backgroundColor: '#FFF8F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 8,
  },
});
