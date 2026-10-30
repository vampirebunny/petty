import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { serverNow } from '../../db/accountMeta';
import type { RaceView } from '../../stadium/api';
import { fetchFriendGame, friendGameHeartbeat, type FriendGameMember, type FriendGameState } from '../../stadium/friendGames';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { eventLabel, eventTip, formatCountdown } from '../../sim/stadium';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ink, shared, softInk } from './parts';

export type FriendRoomExit =
  | { why: 'cancelled'; hostHandle: string | null; byHost: boolean }
  | { why: 'lockedOut' }
  | { why: 'ended' }
  | { why: 'gone' };

type Props = {
  raceId: string;
  petName: string;
  now: number;
  leaving: boolean;
  onLeave: (game: FriendGameState | null) => void;
  onRace: (race: RaceView) => void;
  onExit: (exit: FriendRoomExit) => void;
};

const lateMs = 30_000;

function statusChip(member: FriendGameMember): { label: string; tone: 'ready' | 'wait' | 'out' } {
  if (member.joined) return { label: 'Joined', tone: 'ready' };
  if (member.status === 'declined' || member.status === 'withdrawn') return { label: 'Declined', tone: 'out' };
  return { label: 'Waiting', tone: 'wait' };
}

export function FriendRoom({ raceId, petName, now, leaving, onLeave, onRace, onExit }: Props) {
  const [game, setGame] = useState<FriendGameState | null>(null);
  const handlers = useRef({ onRace, onExit });

  useEffect(() => {
    handlers.current = { onRace, onExit };
  }, [onExit, onRace]);

  useEffect(() => {
    let alive = true;
    let last = 0;
    let inFlight = false;
    let latest: FriendGameState | null = null;
    let done = false;
    const handOff = () => {
      const view = latest;
      if (done || !view) return;
      const race = view.race;
      const at = serverNow();
      if (!race || view.status === 'open' || at < view.startsAt - gameplayConfig.races.countdownMs) return;
      if (!race.players.some((row) => row.mine && row.checkedIn)) return;
      done = true;
      if (at - view.startsAt > lateMs) {
        handlers.current.onExit({ why: 'ended' });
      } else {
        handlers.current.onRace(race);
      }
    };
    const tick = async () => {
      handOff();
      if (done) return;
      const at = serverNow();
      const startsAt = latest?.startsAt ?? null;
      const soon = startsAt != null && startsAt - at <= gameplayConfig.races.lockMs + 5000;
      const every = soon ? 1000 : gameplayConfig.friendGames.heartbeatMs;
      if (inFlight || at - last < every) return;
      inFlight = true;
      last = at;
      const open = latest == null || latest.status === 'open';
      const result = open ? await friendGameHeartbeat(raceId) : await fetchFriendGame(raceId);
      inFlight = false;
      if (!alive || done) return;
      if (!result.ok) {
        if (!result.offline) {
          done = true;
          handlers.current.onExit({ why: 'gone' });
        }
        return;
      }
      const view = result.data;
      latest = view;
      setGame(view);
      if (view.status === 'cancelled') {
        done = true;
        handlers.current.onExit({
          why: 'cancelled',
          hostHandle: view.hostHandle,
          byHost: !view.mineHost && view.cancelReason === 'host_left',
        });
        return;
      }
      if (view.status !== 'open' && !(view.race?.players.some((row) => row.mine && row.checkedIn) ?? false)) {
        done = true;
        handlers.current.onExit({ why: 'lockedOut' });
        return;
      }
      handOff();
    };
    void tick();
    const timer = setInterval(() => void tick(), 500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [raceId]);

  const startsAt = game?.startsAt ?? null;
  const joined = game?.members.filter((member) => member.joined).length ?? 0;

  return (
    <View style={styles.root}>
      <View style={[shared.card, styles.head]}>
        {game?.event ? <EventIcon event={game.event} size={30} /> : null}
        <View style={styles.headText}>
          <Text style={styles.kicker}>
            {game?.event ? eventLabel(game.event) : 'Friend game'} · Friend game
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            Waiting room
          </Text>
        </View>
      </View>
      <View style={styles.countdown} accessibilityLiveRegion="polite">
        <Text style={styles.countLabel}>{startsAt != null && now >= startsAt ? 'And they’re off!' : 'Starts in'}</Text>
        {startsAt != null && now < startsAt ? <Text style={styles.countValue}>{formatCountdown(startsAt - now)}</Text> : null}
      </View>
      <Text style={[shared.copy, styles.center]}>
        {joined >= 2
          ? game?.event
            ? eventTip(game.event, petName)
            : 'Get ready!'
          : 'The race starts when the timer ends if at least one friend is here.'}
      </Text>
      <View style={styles.rows}>
        {(game?.members ?? []).map((member) => {
          const chip = statusChip(member);
          return (
            <View key={member.userId} style={[shared.card, styles.row]}>
              <View style={styles.rowText}>
                <Text style={shared.strong} numberOfLines={1}>
                  {member.mine ? petName : (member.petName ?? `@${member.handle}`)}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[`@${member.handle}`, member.host ? 'Host' : null, member.mine ? 'You' : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.chip, chip.tone === 'ready' ? styles.ready : chip.tone === 'wait' ? styles.wait : styles.out]}>
                {chip.label}
              </Text>
            </View>
          );
        })}
      </View>
      {game == null || game.status === 'open' ? (
        <CandyButton
          role="secondary"
          label={leaving ? 'Leaving…' : game?.mineHost ? 'Cancel game' : 'Leave game'}
          disabled={leaving}
          onPress={() => onLeave(game)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headText: {
    flex: 1,
  },
  kicker: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 13,
    color: softInk,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 24,
    color: ink,
  },
  countdown: {
    alignItems: 'center',
    gap: 2,
  },
  countLabel: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: softInk,
  },
  countValue: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 56,
    color: '#7853E6',
  },
  center: {
    textAlign: 'center',
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    flex: 1,
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  chip: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
  },
  ready: {
    backgroundColor: '#C3F0D7',
    color: '#104A33',
  },
  wait: {
    backgroundColor: '#FFEBA6',
    color: '#6B4E00',
  },
  out: {
    backgroundColor: '#EFE6F7',
    color: '#7A6390',
  },
});
