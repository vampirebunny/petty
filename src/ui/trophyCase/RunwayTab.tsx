import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CachedAward, CachedProgress, ThemeRackPiece, WornPiece } from '../../awards/cache';
import { coverRows, crowdFavoriteCount, friendRows, lookbookTiers, themeTiles, titleCase } from '../../awards/caseModel';
import { LOOKBOOK_THEMES, STAMP_KINDS } from '../../awards/ids';
import { trophyArt } from '../../awards/trophyArt';
import { themeById } from '../../runway/catalog';
import { Cover, Sash, Stamp, Trophy, type StampKind, type StampMotif } from '../awards';
import { fontFamily } from '../font';
import { ThemeBanner } from '../runway/CatwalkArt';
import { Bar, Section, caseTileWidth } from './bits';
import { caseTokens } from './tokens';

type Props = {
  awards: CachedAward[];
  progress: CachedProgress[];
  worn: WornPiece[];
  themeRack: ThemeRackPiece[];
  paneWidth: number;
  onTheme: (themeId: (typeof LOOKBOOK_THEMES)[number]) => void;
};

const FRIEND_LABEL = { host: 'Host', crew: 'Runway Crew', front: 'Front Row' } as const;

export function RunwayTab({ awards, progress, paneWidth, onTheme }: Props) {
  const lookbook = lookbookTiers(awards);
  const themes = themeTiles(awards);
  const covers = coverRows(awards, progress);
  const sashCount = crowdFavoriteCount(awards);
  const friends = friendRows(awards, progress);
  const nextCover = covers.find((row) => !row.earned);
  const themeTile = { width: caseTileWidth(paneWidth) };

  return (
    <View style={styles.wrap}>
      <Section title="Lookbook">
        <View style={styles.lookShelf}>
          {lookbook.map((row) => {
            const art = trophyArt(`lookbook_${row.tier}`);
            return (
              <View key={row.tier} style={styles.lookCard}>
                <Trophy shape={art.shape} material={art.material} earned={row.earned} size={64} />
                <Text style={styles.name}>{titleCase(row.tier)}</Text>
                <Text style={styles.meta}>{`${row.have} / ${row.need}`}</Text>
                <Bar have={row.have} need={row.need} />
              </View>
            );
          })}
        </View>
        <View style={styles.themeGrid}>
          {themes.map((tile) => (
            <Pressable
              key={tile.themeId}
              accessibilityRole="button"
              onPress={() => onTheme(tile.themeId)}
              style={[styles.themeTile, themeTile]}
            >
              <View style={styles.thumb}>
                <ThemeBanner themeId={tile.themeId} labeled={false} />
              </View>
              <Text style={styles.name}>{themeById(tile.themeId)?.name ?? tile.themeId}</Text>
              <Text style={styles.meta}>{`${tile.mainHave} / 4${tile.bonus ? ' + bonus' : ''}`}</Text>
              <View style={styles.minis}>
                {STAMP_KINDS.map((kind) => (
                  <Stamp
                    key={kind}
                    kind={kind as StampKind}
                    motif={tile.themeId as StampMotif}
                    earned={tile.earned[kind]}
                    size={36}
                  />
                ))}
              </View>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title="Cover Stars">
        <View style={styles.coverShelf}>
          {covers.map((row, index) => (
            <View key={row.tier} style={styles.coverCell}>
              <Cover kind="ladder" material={row.tier} level={(index + 1) as 1 | 2 | 3 | 4} earned={row.earned} size={52 + index * 8} />
              <Text style={styles.meta}>{titleCase(row.tier)}</Text>
            </View>
          ))}
        </View>
        {nextCover ? (
          <>
            <Text style={styles.meta}>{`${nextCover.have} / ${nextCover.need} shows to ${titleCase(nextCover.tier)}`}</Text>
            <Bar have={nextCover.have} need={nextCover.need} />
          </>
        ) : (
          <Text style={styles.meta}>Every Cover Star is on the shelf.</Text>
        )}
        <Text style={styles.note}>{"Today's solo shows are counted. Friend shows always count."}</Text>
      </Section>
      <Section title="Crowd Favorite">
        <View style={styles.sashRow}>
          <Sash earned={sashCount > 0} size={88} />
          <Text style={styles.sashCount}>{sashCount > 0 ? `×${sashCount}` : 'Not earned yet'}</Text>
        </View>
      </Section>
      <Section title="Friend shows">
        {friends.map((row) => {
          const next = row.tiers.find((tier) => !tier.earned);
          return (
            <View key={row.kind} style={styles.friendRow}>
              <Text style={styles.friendName}>{FRIEND_LABEL[row.kind]}</Text>
              <View style={styles.friendCovers}>
                {row.tiers.map((tier, index) => (
                  <Cover
                    key={tier.tier}
                    kind="friend"
                    icon={row.kind}
                    material={tier.tier}
                    level={(index + 1) as 1 | 2 | 3}
                    earned={tier.earned}
                    size={44}
                  />
                ))}
              </View>
              <Text style={styles.meta}>
                {next ? `${row.have} / ${next.need} to ${titleCase(next.tier)}` : `${row.have} · complete`}
              </Text>
              {next ? <Bar have={row.have} need={next.need} /> : null}
            </View>
          );
        })}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 22,
  },
  lookShelf: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  lookCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeTile: {
    backgroundColor: caseTokens.card,
    borderRadius: 16,
    padding: 8,
    gap: 4,
  },
  thumb: {
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  minis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  name: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: caseTokens.ink,
    textAlign: 'center',
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  note: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: caseTokens.muted,
  },
  coverShelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  coverCell: {
    alignItems: 'center',
    gap: 4,
  },
  sashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sashCount: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 20,
    color: caseTokens.ink,
  },
  friendRow: {
    gap: 6,
    backgroundColor: caseTokens.card,
    borderRadius: 16,
    padding: 10,
  },
  friendName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.ink,
  },
  friendCovers: {
    flexDirection: 'row',
    gap: 8,
  },
});
