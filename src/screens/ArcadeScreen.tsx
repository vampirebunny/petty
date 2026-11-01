import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { trackScreen } from '../analytics/analytics';
import { CloudHopScreen } from '../minigames/cloudHop/CloudHopScreen';
import { PaddlePawsScreen } from '../minigames/paddlePaws/PaddlePawsScreen';
import { StayScreen } from '../minigames/stay/StayScreen';
import type { PetState } from '../sim/types';
import { FitScale } from '../ui/FitScale';
import { fontFamily } from '../ui/font';
import { HandlePrompt } from '../ui/HandleScreen';
import { HeaderBrand } from '../ui/HeaderBrand';
import { LobbyHero } from '../ui/lobby/LobbyHero';
import { lobbyHeroFill, lobbyPhoneAspect } from '../ui/lobby/heroes';
import { CloudHopIcon } from '../ui/places/cloudHopIcon';
import { PaddlePawsIcon } from '../ui/places/paddlePawsIcon';
import { StayIcon } from '../ui/places/stayIcon';
import { iconStroke } from '../ui/theme';
import { isLandscapeSplit, phoneColumnWidth } from '../ui/wideLayout';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  pendingFriends?: boolean;
  onSettings: () => void;
  onClose: () => void;
};

// These two games are built for a tall screen. On a wide landscape window, keep a portrait column.
function PortraitPlay({ backgroundColor, children }: { backgroundColor: string; children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const column = Math.min(phoneColumnWidth, width, Math.floor(height * 0.7));
  if (width <= height || column >= width - 1) {
    return <View style={styles.fill}>{children}</View>;
  }
  return (
    <View style={[styles.fill, styles.portraitFrame, { backgroundColor }]}>
      <View style={{ width: column, flex: 1 }}>{children}</View>
    </View>
  );
}

// The phone artwork keeps its title band at the top. Start the picture below the status bar so that band stays on screen.
const bannerTop = 52;

export function ArcadeScreen({ pet, reducedMotion, pendingFriends = false, onSettings, onClose }: Props) {
  const [game, setGame] = useState<'hop' | 'paddle' | 'stay' | null>(null);
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);
  const column = split ? phoneColumnWidth : width;
  const tile = Math.min(120, Math.max(84, (column - 56) / 3));
  const artHeight = Math.round(Math.min(width, 560) / lobbyPhoneAspect);
  useEffect(() => {
    trackScreen(game ? 'minigame' : 'arcade');
  }, [game]);

  if (game === 'hop') {
    return (
      <PortraitPlay backgroundColor="#2a2350">
        <CloudHopScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
        <HandlePrompt petName={pet.name} idle={false} />
      </PortraitPlay>
    );
  }

  if (game === 'paddle') {
    return (
      <PortraitPlay backgroundColor="#143a62">
        <PaddlePawsScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
        <HandlePrompt petName={pet.name} idle={false} />
      </PortraitPlay>
    );
  }

  if (game === 'stay') {
    return (
      <View style={styles.fill}>
        <StayScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
        <HandlePrompt petName={pet.name} idle={false} />
      </View>
    );
  }

  const art = (
    <LobbyHero venue="arcade" cut={split ? 'tall' : 'phone'} reducedMotion={reducedMotion} label="Glowing game cabinets">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave"
        onPress={onClose}
        style={[styles.back, split ? styles.backTall : styles.backPhone]}
      >
        <ChevronLeft size={22} color="#2C2F4A" strokeWidth={iconStroke} />
      </Pressable>
      <HeaderBrand
        style={[styles.brand, split ? styles.brandTall : styles.brandPhone]}
        uid="arcade-settings"
        pendingFriends={pendingFriends}
        onSettings={onSettings}
      />
      <Text accessibilityRole="header" style={[styles.heroTitle, split ? styles.heroTitleTall : styles.heroTitlePhone]}>
        Arcade
      </Text>
    </LobbyHero>
  );

  const games = (
    <>
      <Text style={styles.subtitle}>Pick a game for {pet.name}</Text>
      <View style={styles.grid}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cloud Hop" onPress={() => setGame('hop')} style={styles.tile}>
          <CloudHopIcon size={tile} />
          <Text style={styles.label}>Cloud Hop</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Paddle Paws" onPress={() => setGame('paddle')} style={styles.tile}>
          <PaddlePawsIcon size={tile} />
          <Text style={styles.label}>Paddle Paws</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Stay" onPress={() => setGame('stay')} style={styles.tile}>
          <StayIcon size={tile} />
          <Text style={styles.label}>Stay!</Text>
        </Pressable>
      </View>
    </>
  );

  if (split) {
    return (
      <View style={styles.root}>
        <View style={styles.split}>
          <View style={styles.stage}>{art}</View>
          <FitScale designWidth={phoneColumnWidth} style={styles.column}>
            <ScrollView style={styles.stickyScroll} contentContainerStyle={styles.columnScroll} bounces={false}>
              {games}
            </ScrollView>
          </FitScale>
        </View>
        <HandlePrompt petName={pet.name} idle={false} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.phoneBanner, { height: bannerTop + artHeight }]}>
        <View style={[styles.phoneArt, { top: bannerTop, height: artHeight }]}>{art}</View>
      </View>
      <ScrollView style={styles.stickyScroll} contentContainerStyle={styles.scroll} bounces={false}>
        {games}
      </ScrollView>
      <HandlePrompt petName={pet.name} idle={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  portraitFrame: { alignItems: 'center' },
  root: { flex: 1, backgroundColor: '#F6F7FB' },
  phoneBanner: { width: '100%', backgroundColor: lobbyHeroFill.arcade },
  phoneArt: { position: 'absolute', left: 0, right: 0 },
  stickyScroll: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 16 },
  columnScroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 16 },
  split: { flex: 1, flexDirection: 'row' },
  stage: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: lobbyHeroFill.arcade,
  },
  column: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: phoneColumnWidth,
    maxWidth: phoneColumnWidth,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#F6F7FB',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E4D7F2',
  },
  back: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPhone: { top: 8 },
  backTall: { top: 52 },
  brand: { position: 'absolute', right: 12 },
  brandPhone: { top: 6 },
  brandTall: { top: 50 },
  heroTitle: {
    position: 'absolute',
    left: 120,
    right: 128,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    textShadowColor: 'rgba(22, 15, 54, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroTitlePhone: { top: 14 },
  heroTitleTall: { top: 58 },
  subtitle: { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B6F8A' },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center' },
  label: { marginTop: 8, fontFamily: fontFamily.black, fontSize: 16, lineHeight: 20, color: '#2C2F4A', textAlign: 'center' },
});
