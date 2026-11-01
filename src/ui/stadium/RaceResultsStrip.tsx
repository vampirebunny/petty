import { StyleSheet, Text, View } from 'react-native';

import { readAwardsCache } from '../../awards/cache';
import { winsKey } from '../../awards/ids';
import { awardEventOf, trophyArt } from '../../awards/trophyArt';
import type { RaceView } from '../../stadium/api';
import { eventLabel, type RaceClass, type RaceEvent } from '../../sim/stadium';
import { Ribbon, Trophy, type RibbonClass, type RibbonPlacing } from '../awards';
import { fontFamily } from '../font';
import { cardFill, ink, shared } from './parts';

const CAREER_STEPS = [
  { need: 5, name: 'Bronze' },
  { need: 15, name: 'Silver' },
  { need: 40, name: 'Gold' },
  { need: 100, name: 'Platinum' },
  { need: 250, name: 'Diamond' },
] as const;

function ribbonClassOf(race: RaceView): RibbonClass {
  if (race.cup === 'veteran') {
    return 'veteran';
  }
  if (race.event === 'funRun' || race.event === 'meters800') {
    return 'none';
  }
  const cls = race.classId as RaceClass;
  return cls === 'beginner' || cls === 'novice' || cls === 'open' || cls === 'expert' || cls === 'championship' || cls === 'veteran'
    ? cls
    : 'none';
}

function nextUpLine(petId: string, event: RaceEvent): string | null {
  try {
    const row = readAwardsCache(petId).progress.find((item) => item.key === winsKey(event));
    if (!row) {
      return null;
    }
    const step = CAREER_STEPS.find((item) => row.value < item.need);
    if (!step) {
      return null;
    }
    return `Next up: ${row.value} / ${step.need} to ${eventLabel(event)} ${step.name}`;
  } catch {
    return null;
  }
}

type Props = {
  race: RaceView;
  place: number | null;
  petId: string;
};

export function RaceResultsStrip({ race, place, petId }: Props) {
  if (race.cup === 'friends') {
    return null;
  }
  const placing = place === 1 || place === 2 || place === 3 ? (place as RibbonPlacing) : null;
  const trophies = race.awards.filter((award) => award.definitionId !== 'ribbon');
  const next = nextUpLine(petId, race.event);
  const emblem = awardEventOf(race.event);
  if (!placing && trophies.length === 0 && !next) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      {placing ? (
        <View style={styles.ribbon}>
          <Ribbon placing={placing} cls={ribbonClassOf(race)} event={emblem === 'none' ? 'run' : emblem} size={148} />
        </View>
      ) : null}
      {trophies.map((award) => {
        const art = trophyArt(award.definitionId);
        return (
          <View key={award.id} style={styles.card}>
            <Trophy shape={art.shape} material={art.material} event={art.event} size={72} />
            <Text style={styles.cardLabel}>New trophy</Text>
          </View>
        );
      })}
      {next ? <Text style={shared.copy}>{next}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  ribbon: {
    alignItems: 'center',
  },
  card: {
    backgroundColor: cardFill,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
  },
  cardLabel: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: ink,
  },
});
