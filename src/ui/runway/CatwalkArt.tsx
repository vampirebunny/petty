import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { themeById } from '../../runway/catalog';
import { lobbyHero, themePreview } from '../../runway/themePreviews';
import { fontFamily } from '../font';

const stageFill = '#3E2F6E';

export function LobbyBanner() {
  return (
    <View style={styles.fill}>
      <Image source={lobbyHero} style={styles.image} resizeMode="contain" accessibilityLabel="A lit fashion-show stage" />
      <Text style={styles.strut}>Strut your stuff</Text>
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
    top: 108,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    textShadowColor: 'rgba(42, 27, 74, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
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
