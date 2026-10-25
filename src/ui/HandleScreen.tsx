import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { pingAuthHealth } from '../compliance/authHealth';
import { finishHandlePrompt, handlePromptIsStrict, onHandlePrompt } from '../compliance/handlePrompt';
import { getSupabase } from '../compliance/supabase';
import {
  onAccountFlags,
  onStandbyChange,
  readAccountLinked,
  readHandleSaved,
  readStandby,
  setAccountHandle,
  setHandleSaved,
} from '../db/accountMeta';
import { CandyShell, candyInk, tints } from './candy';

type Availability = 'available' | 'taken' | 'reserved' | 'invalid' | null;

const handlePattern = /^[a-zA-Z0-9]{3,20}$/;

type ScreenProps = {
  petName: string;
  allowLater: boolean;
  onSaved: () => void;
  onLater: () => void;
};

function availabilityNote(status: Availability): string | null {
  if (status === 'taken') {
    return 'That handle is taken.';
  }
  if (status === 'reserved' || status === 'invalid') {
    return "That handle isn't available.";
  }
  return null;
}

export function HandleScreen({ petName, allowLater, onSaved, onLater }: ScreenProps) {
  const [handle, setHandle] = useState('');
  const [remote, setRemote] = useState<Availability>(null);
  const [checked, setChecked] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const flavor = tints.lilac;
  const ink = candyInk(flavor);
  const cleaned = handle.trim();
  const shaped = handlePattern.test(cleaned);
  const status: Availability = !shaped ? (cleaned.length === 0 ? null : 'invalid') : checked === cleaned ? remote : null;

  useEffect(() => {
    if (!shaped) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const supabase = getSupabase();
        if (!supabase) {
          return;
        }
        const { data, error } = await supabase.rpc('check_handle_available', { p_handle: cleaned });
        if (cancelled || error || typeof data !== 'string') {
          return;
        }
        setChecked(cleaned);
        setRemote(data as Availability);
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleaned, shaped]);

  const save = () => {
    if (saving || status !== 'available') {
      return;
    }
    setSaving(true);
    setNote(null);
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setNote("You'll need internet to pick a handle.");
        setSaving(false);
        return;
      }
      const { data, error } = await supabase.rpc('claim_handle', { p_handle: cleaned });
      setSaving(false);
      if (error) {
        setNote("We couldn't save that handle. Try again.");
        return;
      }
      if (data === 'saved') {
        setAccountHandle(cleaned);
        onSaved();
        return;
      }
      if (data === 'taken') {
        setChecked(cleaned);
        setRemote('taken');
        setNote('That handle was just taken.');
        return;
      }
      const next = typeof data === 'string' ? (data as Availability) : 'invalid';
      setChecked(cleaned);
      setRemote(next);
      setNote(availabilityNote(next));
    })();
  };

  return (
    <View style={styles.layer}>
      <View style={styles.dim} />
      <CandyShell tint={flavor} radius={28} uid="handle-screen" style={styles.face}>
        <Text style={[styles.title, { color: ink }]}>Pick your handle</Text>
        <Text style={[styles.body, { color: ink }]}>Pick your handle. This is how friends find you.</Text>
        <TextInput
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          placeholder="Your handle"
          placeholderTextColor={flavor.lip}
          style={[styles.input, { color: ink, borderColor: flavor.lip }]}
        />
        {cleaned.length > 0 ? (
          <Text style={[styles.preview, { color: ink }]}>{`@${cleaned} · with ${petName}`}</Text>
        ) : null}
        {note || availabilityNote(status) ? (
          <Text style={[styles.note, { color: ink }]}>{note ?? availabilityNote(status)}</Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={save} style={styles.hit}>
          <View style={[styles.save, { backgroundColor: status === 'available' ? flavor.icon : flavor.lip }]}>
            <Text style={styles.saveText}>{saving ? 'Saving' : 'Save'}</Text>
          </View>
        </Pressable>
        {allowLater ? (
          <Pressable accessibilityRole="button" onPress={onLater} style={styles.hit}>
            <Text style={[styles.later, { color: ink }]}>Later</Text>
          </Pressable>
        ) : null}
      </CandyShell>
    </View>
  );
}

type PromptProps = {
  petName: string;
  idle: boolean;
};

/** Shows the handle screen when a linked account still needs one. Not a sign-in button. */
export function HandlePrompt({ petName, idle }: PromptProps) {
  const [, setTick] = useState(0);
  const [online, setOnline] = useState(false);
  const [hiddenWhileIdle, setHiddenWhileIdle] = useState(false);
  const [seenIdle, setSeenIdle] = useState(idle);
  if (idle !== seenIdle) {
    setSeenIdle(idle);
    if (!idle) {
      setHiddenWhileIdle(false);
    }
  }

  useEffect(() => onAccountFlags(() => setTick((value) => value + 1)), []);
  useEffect(() => onHandlePrompt(() => setTick((value) => value + 1)), []);
  useEffect(() => onStandbyChange(() => setTick((value) => value + 1)), []);

  const linked = readAccountLinked();
  const saved = readHandleSaved();
  const standby = readStandby();
  const strict = handlePromptIsStrict();
  const waiting = linked && !saved && !standby && (strict || (idle && !hiddenWhileIdle));

  useEffect(() => {
    if (!waiting) {
      return;
    }
    let cancelled = false;
    const check = () => {
      void pingAuthHealth().then((ok) => {
        if (!cancelled) {
          setOnline(ok);
        }
      });
    };
    check();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        check();
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [waiting]);

  if (!waiting || !online) {
    return null;
  }

  return (
    <HandleScreen
      petName={petName}
      allowLater={!strict}
      onSaved={() => {
        setHandleSaved(true);
        finishHandlePrompt();
      }}
      onLater={() => {
        finishHandlePrompt();
        setHiddenWhileIdle(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 35,
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
    gap: 10,
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
  input: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  preview: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  hit: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  save: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  later: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
