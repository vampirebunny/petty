import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { findFriendsSnapshot, onFindFriends, openFindFriends } from '../friends/findOpen';
import { loadFriends } from '../friends/api';
import { canUseFriends, inviteShareMessage } from '../friends/rules';
import type { FriendRow } from '../friends/types';
import { maxPlaydateFriends } from '../playdate/party';
import { setSuppressOpenPath } from '../state/sessionGate';
import { AccountSheet } from './AccountSheet';
import { CandyShell, candyInk, tints } from './candy';
import { FriendFace } from './FriendFace';
import { fontFamily } from './font';
import { theme } from './theme';

type Props = {
  linked: boolean;
  petName: string;
  handle: string | null;
  cooling?: boolean;
  selected?: readonly string[];
  onToggle?: (userId: string) => void;
  onInvite?: (friends: FriendRow[]) => void;
};

export function PlaydateFriends({ linked, petName, handle, cooling = false, selected = [], onToggle, onInvite }: Props) {
  const allowed = canUseFriends(linked);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [offline, setOffline] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!allowed) {
      return;
    }
    let cancelled = false;
    const load = () => {
      void loadFriends().then((bundle) => {
        if (cancelled) {
          return;
        }
        setFriends(bundle.friends);
        setOffline(bundle.offline);
      });
    };
    load();
    const unsub = onFindFriends(() => {
      if (!findFriendsSnapshot().open) {
        load();
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [allowed]);

  const invite = () => {
    if (!allowed || cooling || !onInvite) {
      return;
    }
    const chosen = friends.filter((friend) => selected.includes(friend.userId) && friend.pet);
    if (chosen.length === 0) {
      return;
    }
    onInvite(chosen);
  };

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
      {allowed && friends.length > 0 ? <Text style={styles.meta}>Pick up to {maxPlaydateFriends}</Text> : null}
      {allowed
        ? friends.map((friend) => {
            const checked = selected.includes(friend.userId);
            const canPick = friend.pet != null && onToggle != null;
            const full = !checked && selected.length >= maxPlaydateFriends;
            const row = (
              <>
                <FriendFace userId={friend.userId} pet={friend.pet} />
                <View style={styles.copy}>
                  <Text style={styles.handle}>@{friend.handle}</Text>
                  <Text style={styles.meta}>{friend.pet?.name ?? 'No pet yet'}</Text>
                </View>
                {canPick ? (
                  <View style={[styles.check, checked && styles.checkOn]}>
                    {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                ) : null}
              </>
            );
            if (!canPick) {
              return (
                <View key={friend.userId} style={styles.row}>
                  {row}
                </View>
              );
            }
            return (
              <Pressable
                key={friend.userId}
                accessibilityRole="checkbox"
                accessibilityLabel={checked ? `Deselect @${friend.handle}` : `Select @${friend.handle}`}
                accessibilityState={{ checked, disabled: cooling || full }}
                disabled={cooling || full}
                onPress={() => onToggle(friend.userId)}
                style={[styles.row, checked && styles.rowOn, (cooling || full) && styles.dimmed]}
              >
                {row}
              </Pressable>
            );
          })
        : null}
      {allowed ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Find friends" onPress={() => openFindFriends()} style={styles.hit}>
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
      {allowed && friends.length > 0 && onInvite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Invite to playdate"
          accessibilityState={{ disabled: cooling || selected.length === 0 }}
          disabled={cooling || selected.length === 0}
          onPress={invite}
          style={styles.hit}
        >
          {({ pressed }) => (
            <CandyShell tint={tints.mint} radius={22} uid="playdate-party" pressed={pressed} style={[styles.button, (cooling || selected.length === 0) && styles.dimmed]}>
              <Text style={[styles.buttonText, { color: candyInk(tints.mint) }]}>Invite to playdate</Text>
            </CandyShell>
          )}
        </Pressable>
      ) : null}
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
      {accountOpen ? <AccountSheet reason="friends" petName={petName} onClose={() => setAccountOpen(false)} /> : null}
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
  rowOn: {
    backgroundColor: '#DDF6E8',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4E8EF',
  },
  checkOn: {
    backgroundColor: '#4FC98A',
  },
  checkMark: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#14503A',
  },
  dimmed: {
    opacity: 0.4,
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
