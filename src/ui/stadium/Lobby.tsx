import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import type { StadiumBoard, StadiumCard, StadiumSlot } from '../../stadium/api';
import { eventLabel, formatCountdown, formatSlot, whoCanEnter } from '../../sim/stadium';
import { trickListing } from '../../sim/tricks';
import { fontFamily } from '../font';
import { CandyButton } from './CandyButton';
import { EventIcon, ink, shared, softInk } from './parts';

type Props = {
  board: StadiumBoard;
  now: number;
  selected: StadiumSlot | null;
  onSelect: (slot: StadiumSlot) => void;
  onCard: (card: StadiumCard, slot: StadiumSlot) => void;
  onFriends: () => void;
};

export function Lobby({ board, now, selected, onSelect, onCard, onFriends }: Props) {
  return (
    <View style={styles.root}>
      <Text style={shared.section} accessibilityRole="header">
        Upcoming races
      </Text>
      <View style={styles.slots}>
        {board.slots.map((slot) => {
          const on = selected?.id === slot.id;
          return (
            <View key={slot.id} style={styles.slot}>
              <CandyButton
                compact
                role={on ? 'go' : 'secondary'}
                label={formatSlot(slot.startsAt)}
                accessibilityLabel={`Races at ${formatSlot(slot.startsAt)}`}
                onPress={() => onSelect(slot)}
              />
              <Text style={styles.slotIn}>in {formatCountdown(slot.startsAt - now)}</Text>
            </View>
          );
        })}
      </View>
      {selected
        ? selected.events.map((card) => (
            <RaceCard key={card.id} card={card} board={board} now={now} onPress={() => onCard(card, selected)} />
          ))
        : null}
      <CandyButton role="friends" label="Race with friends" onPress={onFriends} />
    </View>
  );
}

function RaceCard({ card, board, now, onPress }: { card: StadiumCard; board: StadiumBoard; now: number; onPress: () => void }) {
  const trickName = card.requiredTrick ? (trickListing(card.requiredTrick)?.name ?? 'a new trick') : null;
  const openEvent = card.event === 'funRun' || card.event === 'dockDive';
  const tag = card.cup === 'veteran' ? 'VETERAN' : card.isAway ? 'AWAY' : openEvent ? 'OPEN' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${eventLabel(card.event)}. ${whoCanEnter(card.speciesAllowed)}. ${card.signedUp} of ${board.capacity} signed up.`}
      onPress={onPress}
      style={({ pressed }) => [shared.card, styles.card, pressed && styles.pressed]}
    >
      <EventIcon event={card.event} />
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {eventLabel(card.event)}
          </Text>
          {tag ? (
            <View style={[styles.tag, card.isAway && styles.awayTag]}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta}>
          {whoCanEnter(card.speciesAllowed)} · {card.signedUp} of {board.capacity} signed up
        </Text>
        {card.state === 'missing_trick' && trickName ? (
          <View style={styles.lockRow}>
            <Lock size={13} color={softInk} strokeWidth={2.2} />
            <Text style={styles.lockText}>Requires skills in {trickName}</Text>
          </View>
        ) : null}
        {card.state === 'resting' && card.restUntil != null ? (
          <Text style={styles.lockText}>Again in {formatCountdown(card.restUntil - now)}</Text>
        ) : null}
      </View>
      <CardAction card={card} onPress={onPress} />
    </Pressable>
  );
}

function CardAction({ card, onPress }: { card: StadiumCard; onPress: () => void }) {
  if (card.state === 'open') {
    return <CandyButton compact role="primary" label="Sign up" onPress={onPress} />;
  }
  if (card.state === 'entered') {
    return <CandyButton compact role="go" label="You're in" onPress={onPress} />;
  }
  return <Text style={styles.pill}>{pillLabel(card)}</Text>;
}

function pillLabel(card: StadiumCard): string {
  if (card.state === 'busy') return 'In a race';
  if (card.state === 'resting') return 'Resting';
  if (card.state === 'missing_trick') return 'Not qualified';
  if (card.state === 'wrong_species') return card.speciesAllowed === 'cat' ? 'Cats only' : 'Dogs only';
  return 'Too late';
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  slots: {
    flexDirection: 'row',
    gap: 10,
  },
  slot: {
    flex: 1,
    alignItems: 'stretch',
    gap: 4,
  },
  slotIn: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontFamily: fontFamily.fredokaBold,
    fontSize: 17,
    color: ink,
  },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#DDF5E8',
  },
  awayTag: {
    backgroundColor: '#E7E0FF',
  },
  tagText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 11,
    color: ink,
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockText: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: softInk,
  },
  pill: {
    maxWidth: 112,
    overflow: 'hidden',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EFEAF4',
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    color: '#8C8399',
    textAlign: 'center',
  },
});
