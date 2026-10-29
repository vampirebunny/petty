import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { serverNow } from '../../db/accountMeta';
import { cancelRaceCall } from '../../reminders/notifications';
import { fetchRace, gateHeartbeat, type LineupRow, type RaceView } from '../../stadium/api';
import { useGatePresence } from '../../stadium/presence';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { classLabel, eventLabel, eventTip, formatCountdown, gatePhase, isPlayableEvent, type RaceSignup } from '../../sim/stadium';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ink, shared, softInk } from './parts';

export type GateExit = 'cancelled' | 'noShow' | 'ended';

type Props = {
  signup: RaceSignup;
  petName: string;
  now: number;
  withdrawing: boolean;
  onWithdraw: () => void;
  onRace: (race: RaceView) => void;
  onExit: (why: GateExit) => void;
};

// Past this, a player coming back from the background lands in the lobby instead of the race.
const lateMs = 30_000;

export function StartingGate({ signup, petName, now, withdrawing, onWithdraw, onRace, onExit }: Props) {
  const [race, setRace] = useState<RaceView | null>(null);
  const present = useGatePresence(signup.raceId, signup.entryId);
  const handlers = useRef({ onRace, onExit });

  useEffect(() => {
    handlers.current = { onRace, onExit };
  }, [onExit, onRace]);

  useEffect(() => {
    void cancelRaceCall();
  }, []);

  useEffect(() => {
    let alive = true;
    let last = 0;
    let inFlight = false;
    let latest: RaceView | null = null;
    let handedOff = false;
    // The hand-off runs on the clock, not on a network reply, so the race screen always opens
    // countdownMs before the start with the latest line-up.
    const handOff = () => {
      const view = latest;
      if (handedOff || !view || !view.players.some((row) => row.mine)) return;
      const at = serverNow();
      const playable = isPlayableEvent(view.event) && at >= signup.startsAt - gameplayConfig.races.countdownMs;
      if (!playable && view.status !== 'finished' && view.status !== 'running') return;
      handedOff = true;
      if (at - signup.startsAt > lateMs) {
        handlers.current.onExit('ended');
      } else {
        handlers.current.onRace(view);
      }
    };
    const tick = async () => {
      handOff();
      if (handedOff) return;
      const at = serverNow();
      const phase = gatePhase(signup.startsAt, at);
      const soon = signup.startsAt - at <= gameplayConfig.races.countdownMs + 5000;
      const every = phase === 'started' || soon ? 1000 : gameplayConfig.races.heartbeatMs;
      if (inFlight || at - last < every) {
        return;
      }
      inFlight = true;
      last = at;
      const result = phase === 'gate' || phase === 'waiting' ? await gateHeartbeat(signup.entryId) : await fetchRace(signup.raceId);
      inFlight = false;
      if (!alive || !result.ok || handedOff) {
        return;
      }
      const view = result.data;
      latest = view;
      setRace(view);
      if (view.status === 'cancelled') {
        handedOff = true;
        handlers.current.onExit('cancelled');
        return;
      }
      if (view.status !== 'open' && !view.players.some((row) => row.mine)) {
        handedOff = true;
        handlers.current.onExit('noShow');
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
  }, [signup.entryId, signup.raceId, signup.startsAt]);

  const phase = gatePhase(signup.startsAt, now);
  const rows = lineup(race?.players ?? [], petName, signup);

  return (
    <View style={styles.root}>
      <View style={[shared.card, styles.head]}>
        <EventIcon event={signup.event} size={30} />
        <View style={styles.headText}>
          <Text style={styles.kicker}>
            {eventLabel(signup.event)} · {classLabel(signup.classId)}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            Starting gate
          </Text>
        </View>
      </View>
      <View style={styles.countdown} accessibilityLiveRegion="polite">
        <Text style={styles.countLabel}>{phase === 'waiting' ? 'Gate opens in' : phase === 'started' ? 'And they’re off!' : 'Starts in'}</Text>
        {phase !== 'started' ? (
          <Text style={styles.countValue}>
            {formatCountdown(phase === 'waiting' ? signup.startsAt - gameplayConfig.races.gateOpenMs - now : signup.startsAt - now)}
          </Text>
        ) : null}
      </View>
      <Text style={[shared.copy, styles.tip]}>{eventTip(signup.event, petName)}</Text>
      <View style={styles.rows}>
        {rows.map((row) => {
          const ready = row.mine || present.includes(row.key);
          return (
            <View key={row.key} style={[shared.card, styles.row]}>
              <Text style={styles.lane}>{row.lane}</Text>
              <View style={styles.rowText}>
                <Text style={shared.strong} numberOfLines={1}>
                  {row.petName}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[row.handle ? `@${row.handle}` : null, row.level != null ? `Lv ${row.level}` : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Text style={[styles.chip, ready ? styles.ready : styles.onWay]}>{ready ? 'Ready' : 'On the way'}</Text>
            </View>
          );
        })}
      </View>
      {phase === 'waiting' || phase === 'gate' ? (
        <CandyButton role="secondary" label={withdrawing ? 'Withdrawing…' : 'Withdraw'} disabled={withdrawing} onPress={onWithdraw} />
      ) : null}
    </View>
  );
}

function lineup(players: LineupRow[], petName: string, signup: RaceSignup): LineupRow[] {
  const own = players.find((row) => row.mine) ?? {
    key: signup.entryId,
    lane: signup.lane,
    petName,
    species: 'dog' as const,
    level: null,
    handle: null,
    checkedIn: true,
    mine: true,
    npc: false,
    skill: null,
    modifiers: null,
    finishMs: null,
    place: null,
    coat: null,
    breedId: null,
  };
  return [own, ...players.filter((row) => !row.mine).sort((a, b) => a.lane - b.lane)];
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
    color: '#EE5A8E',
  },
  tip: {
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
  lane: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#FFE4F2',
    textAlign: 'center',
    lineHeight: 30,
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: ink,
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
  onWay: {
    backgroundColor: '#FFEBA6',
    color: '#6B4E00',
  },
});
