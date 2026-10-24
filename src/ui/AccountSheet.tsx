import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { X } from 'lucide-react-native';

import { beginAppleLink, type AuthCredential } from '../compliance/appleCredential';
import { signInWithGoogle } from '../compliance/googleCredential';
import { linkGuest } from '../compliance/linkAccount';
import { pingAuthHealth } from '../compliance/authHealth';
import { beginRestore } from '../compliance/restoreAccount';
import { getSupabase } from '../compliance/supabase';
import { CandyShell, candyInk, tints } from './candy';
import { iconStroke } from './theme';

export type AccountSheetReason =
  | 'friends'
  | 'purchase'
  | 'day3'
  | 'settings'
  | 'restore'
  | 'reauth'
  | 'apple_reauth';

type Props = {
  reason: AccountSheetReason;
  petName: string;
  onClose: () => void;
  onCredential?: (credential: AuthCredential) => void;
};

const copy: Record<AccountSheetReason, { title: string; body: string }> = {
  friends: {
    title: 'Pick a handle',
    body: 'Pick a handle so friends can find you and bring their pets to play.',
  },
  purchase: {
    title: 'Keep your Boops safe',
    body: 'Keep your Boops safe. Create an account to back them up.',
  },
  day3: {
    title: 'Back up your pet',
    body: 'Back up {petName} and your progress so you never lose them.',
  },
  settings: {
    title: 'Create an account',
    body: 'Create an account to back up {petName}, or sign in to one you already have.',
  },
  restore: {
    title: 'Welcome back',
    body: 'Welcome back! Sign in to bring your pet home.',
  },
  reauth: {
    title: 'Sign in again',
    body: 'Sign in again to keep {petName} backed up.',
  },
  apple_reauth: {
    title: 'Finish deleting',
    body: 'Sign in with Apple once more to finish deleting your account.',
  },
};

const linkReasons = new Set<AccountSheetReason>(['friends', 'purchase', 'day3', 'settings']);

function withPet(text: string, petName: string): string {
  return text.replaceAll('{petName}', petName || 'your pet');
}

export function AccountSheet({ reason, petName, onClose, onCredential }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flavor = tints.sky;
  const ink = candyInk(flavor);
  const lines = copy[reason];
  const closeLabel = reason === 'restore' || reason === 'reauth' || reason === 'apple_reauth';
  const appleOnly = reason === 'apple_reauth';

  if (appleOnly && Platform.OS !== 'ios') {
    return null;
  }

  const start = (provider: 'apple' | 'google') => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void (async () => {
      try {
        const online = await pingAuthHealth();
        if (!online) {
          setNote("You'll need internet to sign in");
          return;
        }
        const credential = provider === 'apple' ? await beginAppleLink() : await signInWithGoogle();
        if (!credential) {
          return;
        }
        if (linkReasons.has(reason)) {
          const prior = await getSupabase()?.auth.getSession();
          const session = prior?.data.session;
          const linked = await linkGuest(credential);
          if (!linked.ok && linked.reason === 'already_linked') {
            const restored = await beginRestore({
              credential,
              guestAccessToken: session?.access_token ?? null,
              guestRefreshToken: session?.refresh_token ?? null,
              guestUserId: session?.user.id ?? null,
              sessionReady: linked.sessionReady,
              providerRefreshToken: linked.providerRefreshToken,
            });
            if (!restored.ok) {
              if (!('cancelled' in restored)) {
                setNote(restored.message);
              }
              return;
            }
            onClose();
            return;
          }
          if (!linked.ok) {
            setNote(linked.message);
            return;
          }
          onClose();
          return;
        }
        onCredential?.(credential);
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        setNote(
          /already linked/i.test(message)
            ? 'That sign-in already belongs to an account. Bringing it back is not ready yet.'
            : "We couldn't sign you in. Try again.",
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <View style={styles.layer}>
      <View style={styles.dim} />
      <CandyShell tint={flavor} radius={28} uid="account-sheet" style={styles.face}>
        <Text style={[styles.title, { color: ink }]}>{lines.title}</Text>
        <Text style={[styles.body, { color: ink }]}>{withPet(lines.body, petName)}</Text>
        {note ? <Text style={[styles.note, { color: ink }]}>{note}</Text> : null}
        {busy ? <ActivityIndicator color={flavor.icon} /> : null}
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={24}
            style={styles.apple}
            onPress={() => start('apple')}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => start('apple')} style={styles.appleFallback}>
            <Text style={styles.appleFallbackText}>Sign in with Apple</Text>
          </Pressable>
        )}
        {appleOnly ? null : (
          <Pressable accessibilityRole="button" onPress={() => start('google')} style={styles.hit}>
            <View style={[styles.google, { borderColor: flavor.lip }]}>
              <Text style={[styles.googleText, { color: ink }]}>Continue with Google</Text>
            </View>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.hit}>
          <View style={styles.dismiss}>
            {closeLabel ? <X size={18} strokeWidth={iconStroke + 1} color={ink} /> : null}
            <Text style={[styles.dismissText, { color: ink }]}>{closeLabel ? 'Close' : 'Not now'}</Text>
          </View>
        </Pressable>
      </CandyShell>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
  },
  face: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
  },
  note: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  apple: {
    alignSelf: 'stretch',
    height: 48,
  },
  appleFallback: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hit: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  google: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  googleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  dismiss: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
