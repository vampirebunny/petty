import { StyleSheet, Text, View } from 'react-native';

import { badgeArt } from '../awards/badgeArt';
import { Badge } from '../awards';
import { badgeLabel } from '../../sim/badges';
import { gameplayConfig } from '../../sim/gameplayConfig';
import { ribbonFacts } from '../../awards/cache';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { Bar, Section, caseTileWidth } from './bits';
import { caseTokens } from './tokens';

const FIRSTS = [
  { id: 'welcome-home', how: 'Bring your pet home' },
  { id: 'came-back', how: 'Visit the day after adopting' },
  { id: 'good-listener', how: 'Master any trick' },
  { id: 'prop-pro', how: 'Master an advanced trick' },
  { id: 'treasure-hunter', how: 'Make a park find' },
  { id: 'dressed-up', how: 'Wear something from the Closet' },
  { id: 'playmate', how: 'Have a playdate' },
  { id: 'off-to-the-races', how: 'Enter a race' },
  { id: 'first-win', how: 'Finish 1st in any race' },
  { id: 'moving-up', how: 'Earn a ribbon above Beginner' },
] as const;

const SERIES = [
  { prefix: 'ribbon-rack', label: 'Ribbon Rack', steps: gameplayConfig.badges.ribbons },
  { prefix: 'best-friend-streak', label: 'Best Friend Streak', steps: gameplayConfig.badges.streak },
  { prefix: 'devoted', label: 'Devoted', steps: gameplayConfig.badges.devoted },
  { prefix: 'trick-collector', label: 'Trick Collector', steps: gameplayConfig.badges.tricks },
  { prefix: 'finder', label: 'Finder', steps: gameplayConfig.badges.finds },
] as const;

type Props = {
  pet: PetState;
  paneWidth: number;
};

export function BadgesTab({ pet, paneWidth }: Props) {
  const earned = new Set(pet.badges ?? []);
  const firstHave = FIRSTS.filter((row) => earned.has(row.id)).length;
  const seriesHave = SERIES.flatMap((row) => ['bronze', 'silver', 'gold'].map((tier) => `${row.prefix}-${tier}`)).filter((id) =>
    earned.has(id),
  ).length;
  const values = seriesValues(pet);
  const badgeTile = { width: caseTileWidth(paneWidth, 108, 10, 5) };

  return (
    <View style={styles.wrap}>
      <Text style={styles.count}>{`${firstHave} of ${FIRSTS.length} · ${firstHave + seriesHave} of 25`}</Text>
      <Section title="One-time">
        <View style={styles.grid}>
          {FIRSTS.map((row) => {
            const art = badgeArt(row.id);
            return (
              <View key={row.id} style={[styles.cell, badgeTile]}>
                <Badge icon={art?.icon} color={art?.color} tier={art?.tier ?? 'none'} earned={earned.has(row.id)} size={72} />
                <Text style={styles.name}>{badgeLabel(row.id)}</Text>
                <Text style={styles.how}>{row.how}</Text>
              </View>
            );
          })}
        </View>
      </Section>
      <Section title="Tiered">
        {SERIES.map((row) => {
          const value = values[row.prefix];
          const nextIndex = row.steps.findIndex((need) => value < need);
          const nextNeed = nextIndex >= 0 ? row.steps[nextIndex] : row.steps[row.steps.length - 1];
          const nextName = nextIndex === 0 ? 'Bronze' : nextIndex === 1 ? 'Silver' : nextIndex === 2 ? 'Gold' : null;
          return (
            <View key={row.prefix} style={styles.series}>
              <View style={styles.seriesRow}>
                {(['bronze', 'silver', 'gold'] as const).map((tier) => {
                  const id = `${row.prefix}-${tier}`;
                  const art = badgeArt(id);
                  return (
                    <View key={id} style={styles.seriesCell}>
                      <Badge icon={art?.icon} color={art?.color} tier={tier} earned={earned.has(id)} size={64} />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.seriesName}>{row.label}</Text>
              <Text style={styles.how}>
                {nextName ? `Next: ${nextName} · ${value} / ${nextNeed}` : `${value} · complete`}
              </Text>
              <Bar have={value} need={nextNeed} />
            </View>
          );
        })}
      </Section>
    </View>
  );
}

function seriesValues(pet: PetState): Record<string, number> {
  const tricks = Object.values(pet.training ?? {}).filter((track) => track?.mastered).length;
  return {
    'ribbon-rack': ribbonFacts(pet.id, pet.ribbons).length,
    'best-friend-streak': pet.openedStreak ?? 0,
    devoted: pet.openedDays ?? 0,
    'trick-collector': tricks,
    finder: pet.parkFinds?.items.length ?? 0,
  };
}

const styles = StyleSheet.create({
  wrap: {
    gap: 22,
  },
  count: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 12,
    color: caseTokens.ink,
    textAlign: 'center',
  },
  how: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  series: {
    gap: 6,
    backgroundColor: caseTokens.card,
    borderRadius: 16,
    padding: 10,
  },
  seriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  seriesCell: {
    alignItems: 'center',
  },
  seriesName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.ink,
  },
});
