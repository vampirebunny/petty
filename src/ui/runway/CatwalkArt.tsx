import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { themeById } from '../../runway/catalog';
import { themePreview } from '../../runway/themePreviews';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { LobbyHero } from '../lobby/LobbyHero';
import { LobbyPet } from '../lobby/LobbyPet';
import { lobbyHeroFill } from '../lobby/heroes';
import { isLandscapeSplit } from '../wideLayout';

const stageFill = lobbyHeroFill.catwalk;

export function LobbyBanner({ pet, reducedMotion }: { pet?: PetState; reducedMotion: boolean }) {
  const { width, height } = useWindowDimensions();
  const tall = isLandscapeSplit(width, height);
  return (
    <View style={styles.fill}>
      <LobbyHero
        venue="catwalk"
        cut={tall ? 'tall' : 'phone'}
        reducedMotion={reducedMotion}
        label="A lit fashion-show stage"
      >
        {pet ? (
          <LobbyPet pet={pet} reducedMotion={reducedMotion} feet={tall ? 0.9 : 0.98} size={tall ? 0.24 : 0.3} />
        ) : null}
        <Text style={[styles.strut, tall ? styles.strutTall : styles.strutPhone]}>Strut your stuff</Text>
      </LobbyHero>
    </View>
  );
}

export function ThemeBanner({ themeId, labeled = true }: { themeId: string; labeled?: boolean }) {
  const source = themePreview(themeId);
  const name = themeById(themeId)?.name ?? 'Theme';
  return (
    <View style={styles.fill}>
      {source ? <Image source={source} style={styles.image} resizeMode="cover" accessibilityLabel={`${name} venue`} /> : null}
      {labeled ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{name}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Theme still with the pet preview drawn on top. */
export function BackstageStage({ themeId, children }: { themeId: string; children: ReactNode }) {
  const source = themePreview(themeId);
  return (
    <View style={styles.fill}>
      {source ? <Image source={source} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.pet} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', backgroundColor: stageFill, overflow: 'hidden' },
  // An Image with flex does not grow to the frame; it stays at the file's point size and leaves the stage color showing.
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  strut: {
    position: 'absolute',
    left: 16,
    right: 16,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    textShadowColor: 'rgba(42, 27, 74, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  // Below the header, in the clear band above the runway.
  strutPhone: { top: 100 },
  strutTall: { top: '14%' },
  pill: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 15, color: '#2A2B4A' },
  pet: { position: 'absolute', left: 0, right: 0, top: 36, bottom: 8, alignItems: 'center', justifyContent: 'flex-end' },
});
