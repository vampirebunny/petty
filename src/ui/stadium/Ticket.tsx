import { StyleSheet, Text, View } from 'react-native';

import type { StadiumCard } from '../../stadium/api';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { classLabel, eventLabel, formatCountdown, formatSlot, gatePhase, type RaceSignup } from '../../sim/stadium';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ReadyBars, ink, shared, softInk } from './parts';

type Props = {
  signup: RaceSignup;
  petName: string;
  energy: number;
  mood: number;
  moodTreats: number;
  now: number;
  others: StadiumCard[];
  withdrawing: boolean;
  onGate: () => void;
  onPlay: () => void;
  onMoodTreat: () => void;
  onShop: () => void;
  onWithdraw: () => void;
};

export function Ticket({ signup, petName, energy, mood, moodTreats, now, others, withdrawing, onGate, onPlay, onMoodTreat, onShop, onWithdraw }: Props) {
  const phase = gatePhase(signup.startsAt, now);
  const gateAt = signup.startsAt - gameplayConfig.races.gateOpenMs;
  return (
    <View style={styles.root}>
      <View style={[shared.card, styles.ticket]}>
        <Text style={styles.kicker} accessibilityRole="header">
          YOU&apos;RE IN!
        </Text>
        <View style={styles.eventRow}>
          <EventIcon event={signup.event} size={30} />
          <View style={styles.eventText}>
            <Text style={styles.event}>{eventLabel(signup.event)}</Text>
            <Text style={shared.copy}>
              {formatSlot(signup.startsAt)} · {classLabel(signup.classId)} · Lane {signup.lane}
            </Text>
          </View>
        </View>
        <View style={styles.times}>
          <View style={styles.time}>
            <Text style={styles.timeLabel}>Gate opens in</Text>
            <Text style={styles.timeValue}>{formatCountdown(gateAt - now)}</Text>
          </View>
          <View style={styles.time}>
            <Text style={styles.timeLabel}>Race starts in</Text>
            <Text style={styles.timeValue}>{formatCountdown(signup.startsAt - now)}</Text>
          </View>
        </View>
        {phase === 'gate' || phase === 'locked' ? (
          <CandyButton role="go" label="Go to the starting gate" onPress={onGate} />
        ) : (
          <Text style={shared.copy}>You don&apos;t have to wait here. We&apos;ll call you when the gate opens, wherever you are.</Text>
        )}
      </View>

      <View style={shared.card}>
        <Text style={shared.strong}>Get {petName} ready</Text>
        <ReadyBars energy={energy} mood={mood} />
        <View style={styles.readyRow}>
          <CandyButton compact role="go" label="Play" onPress={onPlay} style={styles.readyButton} />
          {moodTreats > 0 ? (
            <CandyButton compact role="primary" label={`Mood treat (${moodTreats})`} onPress={onMoodTreat} style={styles.readyButton} />
          ) : (
            <CandyButton compact role="secondary" label="Visit Pet Shop" onPress={onShop} style={styles.readyButton} />
          )}
        </View>
      </View>

      {others.length > 0 ? (
        <View style={styles.others}>
          {others.map((card) => (
            <View key={card.id} style={[shared.card, styles.other]}>
              <EventIcon event={card.event} size={20} />
              <Text style={[shared.strong, styles.otherName]}>{eventLabel(card.event)}</Text>
              <Text style={styles.pill}>One race at a time</Text>
            </View>
          ))}
        </View>
      ) : null}

      {phase !== 'locked' && phase !== 'started' ? (
        <CandyButton role="secondary" label={withdrawing ? 'Withdrawing…' : 'Withdraw from race'} disabled={withdrawing} onPress={onWithdraw} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  ticket: {
    gap: 12,
    borderWidth: 2,
    borderColor: '#FFC8DA',
  },
  kicker: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: '#EE5A8E',
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventText: {
    flex: 1,
    gap: 2,
  },
  event: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 20,
    color: ink,
  },
  times: {
    flexDirection: 'row',
    gap: 10,
  },
  time: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F7F0FF',
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  timeValue: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: ink,
  },
  readyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  readyButton: {
    flex: 1,
  },
  others: {
    gap: 8,
  },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    opacity: 0.6,
  },
  otherName: {
    flex: 1,
  },
  pill: {
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EFEAF4',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    color: '#8C8399',
  },
});
