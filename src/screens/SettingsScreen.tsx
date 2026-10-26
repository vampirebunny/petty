import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChevronLeft, X } from 'lucide-react-native';

import { onAccountFlags, readAccountLinked, setHandleSaved } from '../db/accountMeta';
import { logOutOfAccount } from '../compliance/accountWipe';
import { runAccountDeletion } from '../compliance/deleteAccount';
import { getSupabase } from '../compliance/supabase';
import { setAuthTransition } from '../state/sessionGate';
import type { PetState } from '../sim/types';
import { AccountSheet } from '../ui/AccountSheet';
import { FriendsManage } from '../ui/FriendsManage';
import { CandyShell, GRAY, candyInk, tints } from '../ui/candy';
import { fontFamily } from '../ui/font';
import { HandleScreen } from '../ui/HandleScreen';
import { iconStroke, theme } from '../ui/theme';
import { TraitBars } from '../ui/TraitBars';
import { useOpenedDuoTopInset } from '../ui/useDeviceOrientation';

type Props = {
  pet: PetState;
  petName: string;
  onClose: () => void;
  pendingFriends: number;
  careRemindersOn: boolean;
  onCareReminders: (enabled: boolean) => void;
  onFriendsChanged: () => void;
};

type SignedIn = {
  handle: string | null;
  providers: string;
};

function providerPhrase(identities: { provider: string }[]): string {
  const apple = identities.some((identity) => identity.provider === 'apple');
  const google = identities.some((identity) => identity.provider === 'google');
  if (apple && google) {
    return 'Apple & Google';
  }
  if (apple) {
    return 'Apple';
  }
  if (google) {
    return 'Google';
  }
  return '';
}

export function SettingsScreen({ pet, petName, onClose, pendingFriends, careRemindersOn, onCareReminders, onFriendsChanged }: Props) {
  const duoTop = useOpenedDuoTopInset();
  const [tick, setTick] = useState(0);
  const linked = readAccountLinked();
  const [signedIn, setSignedIn] = useState<SignedIn | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetReason, setSheetReason] = useState<'settings' | 'friends'>('settings');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [handleOpen, setHandleOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [logoutNote, setLogoutNote] = useState<string | null>(null);
  const [appleOpen, setAppleOpen] = useState(false);
  const appleSent = useRef(false);

  useEffect(() => onAccountFlags(() => setTick((value) => value + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (!linked) {
      return;
    }
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        return;
      }
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) {
        return;
      }
      const providers = providerPhrase(user.identities ?? []);
      const profile = await supabase.from('profiles').select('handle').eq('user_id', user.id).maybeSingle();
      if (cancelled) {
        return;
      }
      const handle = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : null;
      setSignedIn({ handle, providers });
    })();
    return () => {
      cancelled = true;
    };
  }, [linked, tick]);

  const submitDelete = async (options?: { skipApple?: boolean; authorizationCode?: string }) => {
    setWorking(true);
    setNote(null);
    setAppleOpen(false);
    const result = await runAccountDeletion(options);
    if (result.ok) {
      return;
    }
    setWorking(false);
    if ('needsApple' in result && result.needsApple) {
      if (options?.authorizationCode) {
        askDeleteAnyway();
        return;
      }
      setAppleOpen(true);
      return;
    }
    if ('offline' in result && result.offline) {
      setNote("You'll need internet to delete your account.");
      return;
    }
    if ('message' in result) {
      setNote(result.message);
    }
  };

  const submitLogOut = async () => {
    setWorking(true);
    setLogoutNote(null);
    const wiped = await logOutOfAccount();
    if (wiped) {
      return;
    }
    setWorking(false);
    setLogoutNote("Couldn't log out just now.");
  };

  const askLogOut = () => {
    Alert.alert(
      'Log out?',
      `${petName} stays saved on your account. This phone goes back to the welcome screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', onPress: () => void submitLogOut() },
      ],
    );
  };

  const askDeleteAnyway = () => {
    Alert.alert("We couldn't reach Apple. Delete anyway?", undefined, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => setAuthTransition('idle'),
      },
      {
        text: 'Delete anyway',
        style: 'destructive',
        onPress: () => void submitDelete({ skipApple: true }),
      },
    ]);
  };

  const confirmed = typed.trim() === 'DELETE';
  const accountCopy = `Delete your account? This permanently deletes your account, ${petName}, your retired pets, your Boops (including any you bought), and everything you own. This can't be undone.`;
  const guestCopy = `Delete your progress? This permanently deletes ${petName} and everything you've done. This can't be undone.`;
  const shown = linked ? signedIn : null;
  const signedLine = shown?.handle
    ? `Signed in as @${shown.handle}${shown.providers ? ` · ${shown.providers}` : ''}`
    : `Signed in with ${shown?.providers || 'your account'} · Pick your handle`;

  if (friendsOpen && linked) {
    return (
      <FriendsManage
        handle={shown?.handle ?? null}
        careRemindersOn={careRemindersOn}
        onCareReminders={onCareReminders}
        onClose={() => setFriendsOpen(false)}
        onChanged={onFriendsChanged}
        onPickHandle={() => {
          setFriendsOpen(false);
          setHandleOpen(true);
        }}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: 64 + duoTop }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            if (!working && !appleOpen) {
              onClose();
            }
          }}
          style={styles.backHit}
        >
          {({ pressed }) => (
            <CandyShell tint={tints.sky} radius={22} uid="settings-back" pressed={pressed} style={styles.back}>
              <ChevronLeft color={candyInk(tints.sky)} size={22} strokeWidth={iconStroke} />
            </CandyShell>
          )}
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {linked && !shown ? (
          <Text style={styles.line}>Signed in</Text>
        ) : linked ? (
          shown?.handle ? (
            <Text style={styles.line}>{signedLine}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setHandleOpen(true)}>
              <Text style={styles.link}>{signedLine}</Text>
            </Pressable>
          )
        ) : (
          <Pressable accessibilityRole="button" onPress={() => {
            setSheetReason('settings');
            setSheetOpen(true);
          }} style={styles.rowHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.pink} radius={22} uid="settings-sign-in" pressed={pressed} style={styles.row}>
                <Text style={[styles.rowText, { color: candyInk(tints.pink) }]}>Sign in or create account</Text>
              </CandyShell>
            )}
          </Pressable>
        )}
        <TraitBars pet={pet} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!linked) {
              setSheetReason('friends');
              setSheetOpen(true);
              return;
            }
            setFriendsOpen(true);
          }}
          style={styles.rowHit}
        >
          {({ pressed }) => (
            <CandyShell tint={tints.mint} radius={22} uid="settings-friends" pressed={pressed} style={styles.row}>
              <Text style={[styles.rowText, { color: candyInk(tints.mint) }]}>
                {pendingFriends > 0 ? `Friends (${pendingFriends})` : 'Friends'}
              </Text>
            </CandyShell>
          )}
        </Pressable>
        {linked ? (
          <Pressable
            accessibilityRole="button"
            disabled={working}
            onPress={askLogOut}
            style={styles.rowHit}
          >
            {({ pressed }) => (
              <CandyShell tint={tints.lilac} radius={22} uid="settings-log-out" pressed={pressed} style={styles.row}>
                <Text style={[styles.rowText, { color: candyInk(tints.lilac) }]}>Log out</Text>
              </CandyShell>
            )}
          </Pressable>
        ) : null}
        {logoutNote ? <Text style={styles.note}>{logoutNote}</Text> : null}
        {logoutNote ? (
          <Pressable accessibilityRole="button" disabled={working} onPress={() => void submitLogOut()} style={styles.rowHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.sky} radius={22} uid="settings-log-out-retry" pressed={pressed} style={styles.row}>
                <Text style={[styles.rowText, { color: candyInk(tints.sky) }]}>Try again</Text>
              </CandyShell>
            )}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={working}
          onPress={() => {
            setTyped('');
            setNote(null);
            setConfirmOpen(true);
          }}
          style={styles.rowHit}
        >
          {({ pressed }) => (
            <CandyShell tint={tints.coral} radius={22} uid="settings-delete" pressed={pressed} style={styles.row}>
              <Text style={[styles.rowText, { color: candyInk(tints.coral) }]}>
                {linked ? 'Delete account' : 'Delete my account'}
              </Text>
            </CandyShell>
          )}
        </Pressable>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {note ? (
          <Pressable accessibilityRole="button" onPress={() => void submitDelete()} style={styles.rowHit}>
            {({ pressed }) => (
              <CandyShell tint={tints.sky} radius={22} uid="settings-retry-page" pressed={pressed} style={styles.row}>
                <Text style={[styles.rowText, { color: candyInk(tints.sky) }]}>Try again</Text>
              </CandyShell>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <Modal transparent visible={confirmOpen} animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.dim}>
          <CandyShell tint={tints.pink} radius={28} uid="settings-confirm" style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              disabled={working}
              onPress={() => setConfirmOpen(false)}
              style={styles.closeHit}
            >
              {({ pressed }) => (
                <View style={[styles.close, pressed && !working && styles.closePressed]}>
                  <X size={18} strokeWidth={iconStroke + 0.4} color={candyInk(tints.pink)} />
                </View>
              )}
            </Pressable>
            <Text style={styles.cardTitle}>{linked ? accountCopy : guestCopy}</Text>
            <Text style={styles.fieldLabel}>Type DELETE to confirm.</Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!working}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!confirmed || working}
              onPress={() => void submitDelete()}
              style={styles.rowHit}
            >
              {({ pressed }) => (
                <CandyShell
                  tint={confirmed && !working ? tints.coral : GRAY}
                  radius={22}
                  uid="settings-confirm-delete"
                  pressed={pressed && confirmed && !working}
                  style={styles.row}
                >
                  <Text
                    style={[
                      styles.rowText,
                      { color: candyInk(confirmed && !working ? tints.coral : GRAY) },
                    ]}
                  >
                    {working ? 'Deleting…' : 'Delete'}
                  </Text>
                </CandyShell>
              )}
            </Pressable>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            {note ? (
              <Pressable accessibilityRole="button" onPress={() => void submitDelete()} style={styles.rowHit}>
                {({ pressed }) => (
                  <CandyShell tint={tints.sky} radius={22} uid="settings-retry" pressed={pressed} style={styles.row}>
                    <Text style={[styles.rowText, { color: candyInk(tints.sky) }]}>Try again</Text>
                  </CandyShell>
                )}
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={working}
              onPress={() => setConfirmOpen(false)}
              style={styles.rowHit}
            >
              {({ pressed }) => (
                <CandyShell tint={tints.sky} radius={22} uid="settings-confirm-cancel" pressed={pressed} style={styles.row}>
                  <Text style={[styles.rowText, { color: candyInk(tints.sky) }]}>Cancel</Text>
                </CandyShell>
              )}
            </Pressable>
          </CandyShell>
        </View>
      </Modal>
      {sheetOpen ? (
        <AccountSheet reason={sheetReason} petName={petName} onClose={() => setSheetOpen(false)} />
      ) : null}
      {appleOpen ? (
        <AccountSheet
          reason="apple_reauth"
          petName={petName}
          onCredential={(credential) => {
            appleSent.current = true;
            if (!credential.authorizationCode) {
              askDeleteAnyway();
              return;
            }
            void submitDelete({ authorizationCode: credential.authorizationCode });
          }}
          onClose={() => {
            setAppleOpen(false);
            if (appleSent.current) {
              appleSent.current = false;
              return;
            }
            askDeleteAnyway();
          }}
        />
      ) : null}
      {handleOpen ? (
        <HandleScreen
          petName={petName}
          allowLater
          onLater={() => setHandleOpen(false)}
          onSaved={() => {
            setHandleSaved(true);
            setHandleOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF6FB',
  },
  header: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backHit: {
    position: 'absolute',
    left: 16,
    top: 10,
    zIndex: 1,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: theme.ink,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  line: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.ink,
  },
  link: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    lineHeight: 22,
    color: candyInk(tints.periwinkle),
  },
  rowHit: {
    alignSelf: 'stretch',
  },
  row: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    textAlign: 'center',
  },
  note: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
    color: theme.ink,
    textAlign: 'center',
  },
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  closeHit: {
    alignSelf: 'flex-end',
    marginRight: -6,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  closePressed: { opacity: 0.7 },
  cardTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: theme.ink,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: fontFamily.extraBold,
    fontSize: 14,
    color: theme.ink,
    textAlign: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: tints.pink.lip,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontFamily: fontFamily.extraBold,
    fontSize: 18,
    color: theme.ink,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});
