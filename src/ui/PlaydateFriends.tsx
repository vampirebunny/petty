import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { blockPlayer, loadFriends, reportPlayer } from '../friends/api';
import { canUseFriends, friendErrorCopy, inviteShareMessage } from '../friends/rules';
import type { FriendRow } from '../friends/types';
import { setSuppressOpenPath } from '../state/sessionGate';
import { AccountSheet } from './AccountSheet';
import { CandyShell, candyInk, tints } from './candy';
import { FindFriends } from './FindFriends';
import { BlockConfirm, ReportSheet, ReportThanks } from './FriendDialogs';
import { FriendFace } from './FriendFace';
import { fontFamily } from './font';
import { theme } from './theme';

type Props = {
  linked: boolean;
  petName: string;
  handle: string | null;
  onPrompt: (moment: 'send' | 'accept') => void;
};

export function PlaydateFriends({ linked, petName, handle, onPrompt }: Props) {
  const allowed = canUseFriends(linked);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [offline, setOffline] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [reportUser, setReportUser] = useState<{ userId: string; handle: string } | null>(null);
  const [thanks, setThanks] = useState<{ userId: string; handle: string } | null>(null);
  const [block, setBlock] = useState<{ userId: string; handle: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => {
    if (!allowed) {
      return;
    }
    void loadFriends().then((bundle) => {
      setFriends(bundle.friends);
      setOffline(bundle.offline);
    });
  };

  useEffect(() => {
    if (!allowed) {
      return;
    }
    let cancelled = false;
    void loadFriends().then((bundle) => {
      if (cancelled) {
        return;
      }
      setFriends(bundle.friends);
      setOffline(bundle.offline);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  const share = () => {
    if (!allowed) {
      return;
    }
    setSuppressOpenPath(true);
    void Share.share({ message: inviteShareMessage(handle) }).finally(() => setSuppressOpenPath(false));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Friends</Text>
      {offline ? <Text style={styles.meta}>Offline</Text> : null}
      {allowed && friends.length === 0 ? <Text style={styles.meta}>No friends yet.</Text> : null}
      {!allowed ? <Text style={styles.meta}>No friends yet.</Text> : null}
      {allowed
        ? friends.map((friend) => (
            <View key={friend.userId} style={styles.row}>
              <FriendFace userId={friend.userId} pet={friend.pet} />
              <View style={styles.copy}>
                <Text style={styles.handle}>@{friend.handle}</Text>
                <Text style={styles.meta}>{friend.pet?.name ?? 'No pet yet'}</Text>
              </View>
            </View>
          ))
        : null}
      {allowed ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Find friends" onPress={() => setFindOpen(true)} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.lilac} radius={22} uid="playdate-find" pressed={pressed} style={styles.button}>
              <Text style={[styles.buttonText, { color: candyInk(tints.lilac) }]}>Find friends</Text>
            </CandyShell>
          )}
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Create an account" onPress={() => setAccountOpen(true)} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.pink} radius={22} uid="playdate-account" pressed={pressed} style={styles.button}>
              <Text style={[styles.buttonText, { color: candyInk(tints.pink) }]}>Create an account</Text>
            </CandyShell>
          )}
        </Pressable>
      )}
      {allowed ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Invite a friend to Boop Boop" onPress={share} style={styles.hit}>
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="playdate-invite" pressed={pressed} style={styles.invite}>
              <Text style={[styles.buttonText, { color: candyInk(tints.sky) }]}>Invite a friend to Boop Boop</Text>
              <Text style={styles.sub}>Share the app so your pets can play together.</Text>
            </CandyShell>
          )}
        </Pressable>
      ) : null}
      {note ? <Text style={styles.meta}>{note}</Text> : null}
      {findOpen ? (
        <FindFriends
          onClose={() => setFindOpen(false)}
          onChanged={refresh}
          onSent={() => onPrompt('send')}
          onAccepted={() => onPrompt('accept')}
          onReport={(userId, reportedHandle) => setReportUser({ userId, handle: reportedHandle })}
        />
      ) : null}
      {accountOpen ? <AccountSheet reason="friends" petName={petName} onClose={() => setAccountOpen(false)} /> : null}
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
            void blockPlayer(person.userId).then(() => refresh());
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    marginBottom: 8,
  },
  heading: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 20,
    color: theme.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 17,
    color: theme.ink,
  },
  meta: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    color: theme.muted,
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
    lineHeight: 18,
    color: theme.muted,
    textAlign: 'center',
  },
});
