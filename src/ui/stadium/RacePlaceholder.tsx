import { StyleSheet, Text, View } from 'react-native';

import type { RaceView } from '../../stadium/api';
import { classLabel, eventLabel } from '../../sim/stadium';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ink, shared, softInk } from './parts';

export function RacePlaceholder({ race, onBack }: { race: RaceView; onBack: () => void }) {
  const rows = [...race.players, ...race.npcs].sort((a, b) => a.lane - b.lane);
  return (
    <View style={styles.root}>
      <View style={[shared.card, styles.head]}>
        <EventIcon event={race.event} size={30} />
        <View style={styles.headText}>
          <Text style={styles.kicker}>{classLabel(race.classId)}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {eventLabel(race.event)}
          </Text>
        </View>
      </View>
      <Text style={shared.section}>Line-up</Text>
      {rows.map((row) => (
        <View key={row.key} style={[shared.card, styles.row]}>
          <Text style={styles.lane}>{row.lane}</Text>
          <Text style={[shared.strong, styles.name]} numberOfLines={1}>
            {row.petName}
          </Text>
          <Text style={styles.meta}>{row.mine ? 'You' : row.npc ? 'Stadium pal' : row.handle ? `@${row.handle}` : ''}</Text>
        </View>
      ))}
      <CandyButton role="primary" label="Race coming soon" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
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
  name: {
    flex: 1,
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
});
