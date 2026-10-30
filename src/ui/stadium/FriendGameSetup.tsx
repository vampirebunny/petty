import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { openFindFriends } from '../../friends/findOpen';
import { fetchCandidates, friendGameErrorCopy, splitRecent, type FriendCandidate, type FriendGameEvent } from '../../stadium/friendGames';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { eventLabel, skillBlock, trickNameFor } from '../../sim/stadium';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { FriendFace } from '../FriendFace';
import { minTouch } from '../theme';
import { CandyButton } from './CandyButton';
import { EventIcon, ink, shared, softInk } from './parts';

type Props = {
  pet: PetState;
  busy: boolean;
  onSend: (event: FriendGameEvent, delayMin: number, invitees: string[]) => void;
  onBack: () => void;
};

const lilac = '#7853E6';

export function FriendGameSetup({ pet, busy, onSend, onBack }: Props) {
  const { events, delaysMin, defaultDelayMin, maxInvites } = gameplayConfig.friendGames;
  const [event, setEvent] = useState<FriendGameEvent>('funRun');
  const [delay, setDelay] = useState<number>(defaultDelayMin);
  const [picked, setPicked] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<{ event: FriendGameEvent; rows: FriendCandidate[]; error: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCandidates(event).then((result) => {
      if (!alive) return;
      setLoaded(
        result.ok
          ? { event, rows: result.data, error: null }
          : { event, rows: [], error: friendGameErrorCopy(result.error) },
      );
    });
    return () => {
      alive = false;
    };
  }, [event]);

  const rows = loaded?.event === event ? loaded.rows : null;
  const error = loaded?.event === event ? loaded.error : null;
  const chosen = picked.filter((id) => rows?.some((row) => row.userId === id && row.hasPet && !row.missingTrick));
  const own = skillBlock(pet, event);
  const { recent, rest } = splitRecent(rows ?? []);
  const full = chosen.length >= maxInvites;

  const toggle = (row: FriendCandidate) => {
    if (!row.hasPet || row.missingTrick) return;
    setPicked((current) => {
      if (current.includes(row.userId)) return current.filter((id) => id !== row.userId);
      return current.length >= maxInvites ? current : [...current, row.userId];
    });
  };

  const friendRow = (row: FriendCandidate) => {
    const on = chosen.includes(row.userId);
    const blocked = !row.hasPet || row.missingTrick != null;
    const reason = !row.hasPet ? 'No pet yet' : row.missingTrick ? `Needs ${trickNameFor(row.missingTrick)}` : null;
    const disabled = blocked || (!on && full);
    return (
      <Pressable
        key={row.userId}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled }}
        accessibilityLabel={`@${row.handle}${row.pet ? `, ${row.pet.name}` : ''}${reason ? `. ${reason}` : ''}`}
        onPress={() => toggle(row)}
        style={[shared.card, styles.friend, blocked && styles.dim, on && styles.friendOn]}
      >
        <FriendFace userId={row.userId} pet={row.pet} />
        <View style={styles.friendText}>
          <Text style={shared.strong} numberOfLines={1}>
            {row.pet?.name ?? `@${row.handle}`}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {reason ?? `@${row.handle}`}
          </Text>
        </View>
        <View style={[styles.box, on && styles.boxOn]}>{on ? <Check size={16} strokeWidth={3} color="#FFFFFF" /> : null}</View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={shared.card}>
        <Text style={styles.title} accessibilityRole="header">
          Race with friends
        </Text>
        <Text style={shared.copy}>Just for fun: no XP, ribbons, or rest. Every pet races in the Open class.</Text>
      </View>

      <Text style={shared.section}>Pick a race</Text>
      <View style={styles.chips}>
        {events.map((id) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: event === id }}
            onPress={() => setEvent(id)}
            style={[styles.eventChip, event === id && styles.chipOn]}
          >
            <EventIcon event={id} size={20} />
            <Text style={styles.chipText}>{eventLabel(id)}</Text>
          </Pressable>
        ))}
      </View>
      {own ? <Text style={styles.warn}>{pet.name} needs {own.trickName} for this race.</Text> : null}

      <Text style={shared.section}>Starts in</Text>
      <View style={styles.chips}>
        {delaysMin.map((min) => (
          <Pressable
            key={min}
            accessibilityRole="radio"
            accessibilityState={{ selected: delay === min }}
            onPress={() => setDelay(min)}
            style={[styles.delayChip, delay === min && styles.chipOn]}
          >
            <Text style={styles.chipText}>{min} min</Text>
          </Pressable>
        ))}
      </View>

      <Text style={shared.section}>
        Invite friends ({chosen.length}/{maxInvites})
      </Text>
      {rows == null ? (
        <Text style={shared.copy}>Loading your friends…</Text>
      ) : error ? (
        <Text style={shared.copy}>{error}</Text>
      ) : rows.length === 0 ? (
        <View style={[shared.card, styles.empty]}>
          <Text style={[shared.copy, styles.center]}>Add friends to race with them.</Text>
          <CandyButton role="friends" label="Find friends" onPress={() => openFindFriends()} />
        </View>
      ) : (
        <>
          {recent.length > 0 ? <Text style={styles.group}>Recent</Text> : null}
          {recent.map(friendRow)}
          {rest.length > 0 ? <Text style={styles.group}>All friends</Text> : null}
          {rest.map(friendRow)}
        </>
      )}

      <CandyButton
        role="friends"
        label={busy ? 'Sending…' : 'Send invites'}
        disabled={busy || chosen.length === 0 || own != null}
        onPress={() => onSend(event, delay, chosen)}
      />
      <CandyButton role="secondary" label="Back to the Stadium" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 24,
    color: ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: minTouch,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 14,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E4D6F5',
    backgroundColor: '#FFFFFF',
  },
  delayChip: {
    minHeight: minTouch,
    minWidth: 76,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E4D6F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: lilac,
    backgroundColor: '#F1EAFF',
  },
  chipText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: ink,
  },
  warn: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: '#B4432F',
  },
  group: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: softInk,
  },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  friendOn: {
    borderColor: lilac,
  },
  friendText: {
    flex: 1,
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D8C8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: lilac,
    borderColor: lilac,
  },
  dim: {
    opacity: 0.5,
  },
  empty: {
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
