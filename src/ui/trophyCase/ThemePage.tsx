import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CachedAward, ThemeRackPiece, WornPiece } from '../../awards/cache';
import { stampLabel, wornForTheme } from '../../awards/caseModel';
import { STAMP_KINDS } from '../../awards/ids';
import { themeById } from '../../runway/catalog';
import { Stamp, type StampKind, type StampMotif } from '../awards';
import { fontFamily } from '../font';
import { ThemeBanner } from '../runway/CatwalkArt';
import { StampSheet } from './StampSheet';
import { caseTokens } from './tokens';

type Props = {
  themeId: string;
  awards: CachedAward[];
  worn: WornPiece[];
  themeRack: ThemeRackPiece[];
  onBack: () => void;
};

const MAIN: StampKind[] = ['debut', 'encore', 'party', 'rack'];

export function ThemePage({ themeId, awards, worn, themeRack, onBack }: Props) {
  const theme = themeById(themeId);
  const [open, setOpen] = useState<StampKind | null>(null);
  const rack = wornForTheme(worn, themeId, themeRack);
  const wornLabel = rack.need > 0 ? `${rack.have} / ${rack.need} pieces` : rack.have > 0 ? `${rack.have} pieces` : '0 / 0 pieces';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backHit}>
        <Text style={styles.back}>Lookbook</Text>
      </Pressable>
      <View style={styles.banner}>
        <ThemeBanner themeId={themeId} />
      </View>
      <Text style={styles.title}>{theme?.name ?? themeId}</Text>
      <View style={styles.album}>
        {MAIN.map((kind) => {
          const earned = awards.some((award) => award.definitionId === `stamp_${themeId}_${kind}`);
          return (
            <Pressable key={kind} accessibilityRole="button" onPress={() => setOpen(kind)} style={styles.stamp}>
              <Stamp kind={kind} motif={themeId as StampMotif} earned={earned} size={120} />
              <Text style={styles.stampName}>{stampLabel(kind)}</Text>
              {kind === 'rack' ? <Text style={styles.worn}>{wornLabel}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setOpen('star')} style={styles.bonus}>
        <Stamp
          kind="star"
          motif={themeId as StampMotif}
          earned={awards.some((award) => award.definitionId === `stamp_${themeId}_star`)}
          size={96}
        />
        <View style={styles.bonusCopy}>
          <Text style={styles.stampName}>Showstopper</Text>
          <Text style={styles.worn}>Win Crowd Favorite in this theme</Text>
        </View>
      </Pressable>
      {open && STAMP_KINDS.includes(open) ? (
        <StampSheet
          kind={open}
          motif={themeId as StampMotif}
          earned={awards.some((award) => award.definitionId === `stamp_${themeId}_${open}`)}
          wornLabel={open === 'rack' ? wornLabel : null}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  body: {
    paddingBottom: 28,
    gap: 12,
  },
  backHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  back: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.purple,
  },
  banner: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  album: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: caseTokens.paper,
    borderRadius: 18,
    padding: 10,
    gap: 8,
  },
  stamp: {
    width: '47%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  stampName: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: caseTokens.ink,
    textAlign: 'center',
  },
  worn: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    color: caseTokens.muted,
    textAlign: 'center',
  },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: caseTokens.card,
    borderRadius: 16,
    padding: 10,
  },
  bonusCopy: {
    flex: 1,
    gap: 2,
  },
});
