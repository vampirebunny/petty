import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { emptyAwardsCache, readAwardsCache, refreshAwardsCache, type AwardsCache } from '../../awards/cache';
import { settingsCardModel, type CardShelfItem, type LeftoverRibbon } from '../../awards/caseModel';
import { stampArt } from '../../awards/runwayArt';
import { awardEventOf, trophyArt } from '../../awards/trophyArt';
import { CandyShell, candyInk, tints } from '../candy';
import { fontFamily } from '../font';
import { Ribbon, Stamp, Trophy, type RibbonClass } from '../awards';
import { caseTokens } from './tokens';

type Props = {
  petId: string;
  petName: string;
  leftover?: LeftoverRibbon[];
  onOpen: () => void;
};

export function TrophyCaseCard({ petId, petName, leftover = [], onOpen }: Props) {
  const [cache, setCache] = useState<AwardsCache>(() => {
    try {
      return readAwardsCache(petId);
    } catch {
      return emptyAwardsCache();
    }
  });

  useEffect(() => {
    let cancelled = false;
    void refreshAwardsCache(petId)
      .then((next) => {
        if (!cancelled) {
          setCache(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [petId]);

  const model = useMemo(
    () => settingsCardModel(cache.awards, leftover, cache.definitions),
    [cache.awards, cache.definitions, leftover],
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Trophy Case</Text>
        <Text style={styles.best}>{model.empty ? 'Nothing yet' : `${petName}'s best`}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Trophy Case" onPress={onOpen} style={styles.shelfHit}>
        <View style={styles.shelf}>
          {model.empty ? (
            <>
              <Trophy shape="handles" material="gold" earned={false} size={62} />
              <Trophy shape="grand" material="gold" earned={false} size={80} />
              <Trophy shape="cup" material="bronze" earned={false} size={62} />
            </>
          ) : (
            model.shelf.map((item, index) => <ShelfArt key={shelfKey(item, index)} item={item} center={index === 1 || model.shelf.length === 1} />)
          )}
        </View>
      </Pressable>
      {model.empty ? (
        <Text style={styles.empty}>
          {`Win a race or walk a runway show to start filling ${petName}'s shelf.`}
        </Text>
      ) : (
        <View style={styles.chips}>
          <Chip label="Trophies" value={model.trophies} />
          <Chip label="Ribbons" value={model.ribbons} />
          <Chip label="Stamps" value={model.stamps} />
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Open Trophy Case" onPress={onOpen} style={styles.hit}>
        {({ pressed }) => (
          <CandyShell tint={tints.butter} radius={22} uid="settings-open-trophy-case" pressed={pressed} style={styles.go}>
            <Text style={[styles.goLabel, { color: candyInk(tints.butter) }]}>Open Trophy Case</Text>
          </CandyShell>
        )}
      </Pressable>
    </View>
  );
}

function ShelfArt({ item, center }: { item: CardShelfItem; center: boolean }) {
  const size = center ? 80 : 62;
  if (item.kind === 'trophy') {
    const art = trophyArt(item.definitionId);
    return <Trophy shape={art.shape} material={art.material} event={art.event} earned size={size} />;
  }
  if (item.kind === 'stamp') {
    const art = stampArt(item.definitionId);
    return <Stamp kind={art?.kind ?? 'debut'} motif={art?.motif ?? 'space'} earned size={size} />;
  }
  const event = awardEventOf(item.event);
  return (
    <Ribbon
      placing={item.place === 2 || item.place === 3 ? item.place : 1}
      cls={ribbonClass(item.classId)}
      event={event === 'none' ? 'run' : event}
      size={size}
    />
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function shelfKey(item: CardShelfItem, index: number): string {
  if (item.kind === 'trophy' || item.kind === 'stamp') {
    return `${item.definitionId}-${item.earnedAt}-${index}`;
  }
  return `ribbon-${item.event}-${item.classId}-${item.place}-${item.earnedAt}-${index}`;
}

function ribbonClass(classId: string): RibbonClass {
  if (
    classId === 'beginner' ||
    classId === 'novice' ||
    classId === 'open' ||
    classId === 'expert' ||
    classId === 'championship' ||
    classId === 'veteran'
  ) {
    return classId;
  }
  return 'none';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: caseTokens.card,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 18,
    color: caseTokens.ink,
  },
  best: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: caseTokens.muted,
  },
  shelfHit: {
    alignSelf: 'stretch',
  },
  shelf: {
    minHeight: 96,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 16,
    backgroundColor: caseTokens.shelf,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  empty: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  chip: {
    alignItems: 'center',
  },
  chipValue: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 20,
    color: caseTokens.ink,
  },
  chipLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: caseTokens.muted,
  },
  hit: {
    alignSelf: 'stretch',
  },
  go: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLabel: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 17,
  },
});
