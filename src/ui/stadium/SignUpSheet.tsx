import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StadiumCard, StadiumSlot } from '../../stadium/api';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { classLabel, eventLabel, formatCountdown, formatSlot, type RaceClass } from '../../sim/stadium';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ReadyBars, ink, shared, softInk } from './parts';

type Props = {
  card: StadiumCard;
  slot: StadiumSlot;
  classId: RaceClass;
  capacity: number;
  petName: string;
  energy: number;
  mood: number;
  now: number;
  busy: boolean;
  onSignUp: () => void;
  onClose: () => void;
  /** Fill the right-hand column on a wide screen instead of rising as a bottom sheet. */
  panel?: boolean;
};

export function SignUpSheet({ card, slot, classId, capacity, petName, energy, mood, now, busy, onSignUp, onClose, panel = false }: Props) {
  const low = Math.min(energy, mood) < 50;
  const others = card.signedUp;
  const form = (
          <>
          <View style={styles.head}>
            <EventIcon event={card.event} size={30} />
            <View style={styles.headText}>
              <Text style={styles.title} accessibilityRole="header">
                {eventLabel(card.event)}
              </Text>
              <Text style={shared.copy}>
                {formatSlot(slot.startsAt)} · starts in {formatCountdown(slot.startsAt - now)} · {classLabel(classId)}
              </Text>
            </View>
          </View>

          <View style={shared.card}>
            <Text style={shared.strong}>Line-up so far</Text>
            <Text style={shared.copy}>
              {others === 0 ? 'No one has signed up yet.' : `${others} of ${capacity} signed up.`}
            </Text>
            <View style={styles.laneRow}>
              <Text style={styles.lane}>{others + 1}</Text>
              <Text style={shared.strong}>{petName}</Text>
              <Text style={styles.you}>You</Text>
            </View>
            <Text style={shared.copy}>If no one else joins, friendly NPC pets will race with you.</Text>
          </View>

          <View style={shared.card}>
            <Text style={shared.strong}>Race readiness</Text>
            <ReadyBars energy={energy} mood={mood} />
            {low ? <Text style={shared.copy}>A little play or a mood treat helps {petName} feel race-ready.</Text> : null}
          </View>

          <Text style={shared.copy}>
            Go anywhere you like. We&apos;ll call you {Math.round(gameplayConfig.races.callMs / 1000)} seconds before the start.
          </Text>
          <Text style={shared.copy}>Free to enter. Change your mind? You can withdraw until 10 seconds before the start.</Text>

          <CandyButton role="primary" label={busy ? 'Signing up…' : `Sign up ${petName}`} disabled={busy} onPress={onSignUp} />
          <CandyButton role="secondary" label="Not now" onPress={onClose} />
          </>
  );
  if (panel) {
    return (
      <View style={styles.panel}>
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={[styles.content, styles.panelContent]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {form}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={styles.layer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onClose} style={styles.dim} />
      <View style={styles.sheet} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content} bounces={false} showsVerticalScrollIndicator={false}>
          {form}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFF6FB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFF6FB',
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    paddingTop: 108,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 24,
    color: ink,
  },
  laneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lane: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFE4F2',
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: fontFamily.fredokaBold,
    fontSize: 14,
    color: ink,
  },
  you: {
    marginLeft: 'auto',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    color: softInk,
  },
});
