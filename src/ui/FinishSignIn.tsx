import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  accountSessionIsCurrent,
  cancelRestore,
  resumeRestore,
} from '../compliance/restoreAccount';
import { AccountSheet } from './AccountSheet';
import { CandyShell, candyInk, tints } from './candy';

type Props = {
  petName: string;
  onSettled?: () => void;
};

export function FinishSignIn({ petName, onSettled }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lostGuest, setLostGuest] = useState(false);
  const [sheet, setSheet] = useState(false);
  const flavor = tints.sky;
  const ink = candyInk(flavor);

  const finish = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNote(null);
    void (async () => {
      if (await accountSessionIsCurrent()) {
        const restored = await resumeRestore();
        setBusy(false);
        if (!restored.ok && 'message' in restored) {
          setNote(restored.message);
        }
        onSettled?.();
        return;
      }
      setBusy(false);
      setSheet(true);
    })();
  };

  const cancel = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    void (async () => {
      const result = await cancelRestore();
      setBusy(false);
      if (result === 'lost') {
        setLostGuest(true);
        setNote("We couldn't get your guest pet back. Sign in to bring your account's pet home.");
      }
      onSettled?.();
    })();
  };

  return (
    <View style={styles.layer}>
      <CandyShell tint={flavor} radius={28} uid="finish-sign-in" style={styles.face}>
        <Text style={[styles.title, { color: ink }]}>Finish signing in?</Text>
        {note ? <Text style={[styles.body, { color: ink }]}>{note}</Text> : null}
        <Pressable accessibilityRole="button" onPress={finish} style={styles.hit}>
          <View style={[styles.primary, { backgroundColor: flavor.icon }]}>
            <Text style={styles.primaryText}>Finish</Text>
          </View>
        </Pressable>
        {lostGuest ? null : (
          <Pressable accessibilityRole="button" onPress={cancel} style={styles.hit}>
            <Text style={[styles.cancel, { color: ink }]}>Cancel</Text>
          </Pressable>
        )}
      </CandyShell>
      {sheet ? (
        <AccountSheet
          reason="restore"
          petName={petName}
          onClose={() => setSheet(false)}
          onCredential={(credential) => {
            setSheet(false);
            setBusy(true);
            void (async () => {
              const { beginRestore } = await import('../compliance/restoreAccount');
              const restored = await beginRestore({
                credential,
                guestAccessToken: null,
                guestRefreshToken: null,
                guestUserId: null,
                sessionReady: false,
              });
              setBusy(false);
              if (!restored.ok && !('cancelled' in restored)) {
                setNote(restored.message);
              }
              onSettled?.();
            })();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#FAAB45',
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
  hit: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cancel: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
