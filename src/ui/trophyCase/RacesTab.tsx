import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CachedAward, CachedProgress } from '../../awards/cache';
import {
  CLASS_PILLS,
  bestAllRounder,
  careerCards,
  caseRibbons,
  classTrophies,
  featRows,
  featTitle,
  groupRibbons,
  hasAward,
  recentRibbonEvents,
  titleCase,
  trophySheet,
  type LeftoverRibbon,
  type TrophySheetKind,
  type TrophySheetModel,
} from '../../awards/caseModel';
import { GRAND_CHAMPION_ID } from '../../awards/ids';
import { awardEventOf, trophyArt } from '../../awards/trophyArt';
import { classForLevel, classLabel, eventLabel } from '../../sim/stadium';
import type { RaceClass, RaceEvent } from '../../sim/stadium';
import { Ribbon, Trophy } from '../awards';
import { fontFamily } from '../font';
import { Bar, Section, caseTileWidth } from './bits';
import { EmptyRaces } from './EmptyRaces';
import { RibbonSheet } from './RibbonSheet';
import { TrophySheet } from './TrophySheet';
import { caseTokens } from './tokens';

type Props = {
  petName: string;
  level: number;
  awards: CachedAward[];
  progress: CachedProgress[];
  leftover: LeftoverRibbon[];
  empty: boolean;
  paneWidth: number;
  onStadium: () => void;
};

export function RacesTab({ petName, level, awards, progress, leftover, empty, paneWidth, onStadium }: Props) {
  const currentClass = classForLevel(level);
  const [classId, setClassId] = useState<string>(currentClass === 'veteran' ? 'championship' : currentClass);
  const [sheet, setSheet] = useState<TrophySheetModel | null>(null);
  const [ribbonsOpen, setRibbonsOpen] = useState(false);
  const ribbons = useMemo(() => caseRibbons(awards, leftover), [awards, leftover]);
  const groups = useMemo(() => groupRibbons(ribbons), [ribbons]);
  const recent = recentRibbonEvents(groups, 2);
  const career = careerCards(awards, progress);
  const classes = classTrophies(awards, progress, classId, currentClass === 'veteran' ? 'championship' : currentClass);
  const feats = featRows(awards, progress);
  const allRounder = bestAllRounder(awards);
  const grand = hasAward(awards, GRAND_CHAMPION_ID);
  const pairTile = { width: caseTileWidth(paneWidth) };
  const featTile = { width: caseTileWidth(paneWidth, 108, 10, 5) };

  const openSheet = (kind: TrophySheetKind, opts: { event?: string; classId?: string; feat?: string }) => {
    setSheet(trophySheet(kind, awards, progress, opts));
  };

  if (empty) {
    return <EmptyRaces name={petName} awards={awards} onStadium={onStadium} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.totals}>
        <Total label="Trophies" value={awards.filter((row) => row.source === 'race' && row.definitionId !== 'ribbon').length} />
        <Total label="Ribbons" value={ribbons.length} />
        <Total label="Wins" value={Math.max(ribbons.filter((row) => row.place === 1).length, career.reduce((sum, row) => sum + row.wins, 0))} />
      </View>
      <Section title="Showcase">
        <View style={styles.showcase}>
          <Showcase
            label={allRounder ? `All-Rounder · ${titleCase(allRounder.classId)}` : 'All-Rounder'}
            earned={Boolean(allRounder)}
            shape="handles"
          />
          <Showcase label="Grand Champion" earned={grand} shape="grand" size={88} />
          <Showcase label="Seasonal" earned={false} shape="big" material="seasonal" />
        </View>
      </Section>
      <Section title="Career">
        <View style={styles.career}>
          {career.map((row) => {
            const art = trophyArt(`career_${row.event}_${row.tier ?? 'bronze'}`);
            return (
              <Pressable
                key={row.event}
                accessibilityRole="button"
                onPress={() => openSheet('career', { event: row.event })}
                style={[styles.careerCard, pairTile]}
              >
                <Trophy shape={art.shape} material={art.material} event={art.event} earned={Boolean(row.tier)} size={56} />
                <Text style={styles.cardName}>{eventTitle(row.event)}</Text>
                <Text style={styles.cardMeta}>{row.tier ? titleCase(row.tier) : 'Bronze'}</Text>
                {row.nextNeed != null && row.nextTier ? (
                  <>
                    <Text style={styles.barLabel}>{`${row.wins} / ${row.nextNeed} to ${titleCase(row.nextTier)}`}</Text>
                    <Bar have={row.wins} need={row.nextNeed} />
                  </>
                ) : (
                  <Text style={styles.barLabel}>Diamond</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Section>
      <Section title="Class trophies">
        <View style={styles.pills}>
          {CLASS_PILLS.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: classId === id }}
              onPress={() => setClassId(id)}
              style={[styles.pill, classId === id && styles.pillOn]}
            >
              <Text style={[styles.pillText, classId === id && styles.pillTextOn]}>{classLabel(id as RaceClass)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.classGrid}>
          {classes.map((row) => {
            const art = trophyArt(`class_${row.event}_${classId}`);
            return (
              <Pressable
                key={row.event}
                accessibilityRole="button"
                onPress={() => openSheet('class', { event: row.event, classId })}
                style={[styles.classCell, pairTile]}
              >
                <Trophy shape={art.shape} material={art.material} event={art.event} earned={row.earned && !row.locked} size={64} />
                <Text style={styles.cardName}>{eventTitle(row.event)}</Text>
                <Text style={styles.cardMeta}>
                  {row.locked
                    ? `Unlocks when ${petName} reaches ${classLabel(row.unlockClass as RaceClass)}`
                    : row.earned
                      ? 'Won'
                      : classId === 'championship'
                        ? `${row.wins} / ${row.need} in a row`
                        : `${row.wins} / ${row.need}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      <Section title="Feats">
        <View style={styles.featGrid}>
          {feats.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => openSheet('feat', { feat: row.feat })}
              style={[styles.featCell, featTile]}
            >
              <Trophy shape="star" material="gold" earned={row.earned} size={58} />
              <Text style={styles.cardName}>{featTitle(row.feat)}</Text>
              <Text style={styles.cardMeta}>
                {row.feat === 'personal_best' && row.count
                  ? `×${row.count}`
                  : row.earned
                    ? 'Won'
                    : row.detail}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title="Ribbons">
        {recent.map((group) => (
          <View key={group.event} style={styles.ribbonEvent}>
            <Text style={styles.ribbonEventName}>{eventTitle(group.event)}</Text>
            <View style={styles.ribbonRow}>
              {group.rows.map((row) => (
                <View key={`${row.classId}-${row.place}`} style={styles.ribbonCell}>
                  <Ribbon
                    placing={row.place === 2 || row.place === 3 ? row.place : 1}
                    cls={
                      row.classId === 'beginner' ||
                      row.classId === 'novice' ||
                      row.classId === 'open' ||
                      row.classId === 'expert' ||
                      row.classId === 'championship' ||
                      row.classId === 'veteran'
                        ? row.classId
                        : 'none'
                    }
                    event={ribbonEvent(row.event)}
                    size={64}
                  />
                  {row.count > 1 ? <Text style={styles.count}>×{row.count}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ))}
        {groups.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setRibbonsOpen(true)}>
            <Text style={styles.seeAll}>See all ribbons</Text>
          </Pressable>
        ) : (
          <Text style={styles.cardMeta}>No ribbons yet.</Text>
        )}
      </Section>
      <TrophySheet model={sheet} petName={petName} onClose={() => setSheet(null)} />
      {ribbonsOpen ? <RibbonSheet groups={groups} onClose={() => setRibbonsOpen(false)} /> : null}
    </View>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

function Showcase({
  label,
  earned,
  shape,
  material = 'gold',
  size = 72,
}: {
  label: string;
  earned: boolean;
  shape: 'handles' | 'grand' | 'big';
  material?: 'gold' | 'seasonal';
  size?: number;
}) {
  return (
    <View style={styles.showcaseCell}>
      <Trophy shape={shape} material={material} earned={earned} size={size} />
      <Text style={styles.cardName}>{label}</Text>
    </View>
  );
}

function eventTitle(event: string): string {
  return eventLabel(event as RaceEvent) || titleCase(event);
}

function ribbonEvent(event: string): Exclude<ReturnType<typeof awardEventOf>, 'none'> {
  const art = awardEventOf(event);
  return art === 'none' ? 'run' : art;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 22,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  total: {
    alignItems: 'center',
  },
  totalValue: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: caseTokens.ink,
  },
  totalLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: caseTokens.muted,
  },
  showcase: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: caseTokens.shelf,
    borderRadius: 20,
    padding: 12,
  },
  showcaseCell: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  career: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  careerCard: {
    backgroundColor: caseTokens.card,
    borderRadius: 16,
    padding: 10,
    gap: 4,
    alignItems: 'center',
  },
  cardName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: caseTokens.ink,
    textAlign: 'center',
  },
  cardMeta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  barLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F0E6D6',
  },
  pillOn: {
    backgroundColor: caseTokens.purple,
  },
  pillText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 12,
    color: caseTokens.muted,
  },
  pillTextOn: {
    color: '#FFF8EE',
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  classCell: {
    alignItems: 'center',
    gap: 4,
  },
  featGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featCell: {
    alignItems: 'center',
    gap: 4,
  },
  ribbonEvent: {
    gap: 8,
  },
  ribbonEventName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.ink,
  },
  ribbonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ribbonCell: {
    alignItems: 'center',
  },
  count: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 12,
    color: caseTokens.purple,
  },
  seeAll: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.purple,
  },
});
