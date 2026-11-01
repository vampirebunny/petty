import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { lobbyHeroFill, lobbyHeroes, type LobbyCut, type LobbyVenue } from './heroes';

type Props = {
  venue: LobbyVenue;
  cut: LobbyCut;
  reducedMotion: boolean;
  /** False while this lobby is covered or left. The player also pauses in the background. */
  active?: boolean;
  label: string;
  children?: ReactNode;
};

export function LobbyHero({ venue, cut, reducedMotion, active = true, label, children }: Props) {
  if (reducedMotion) {
    return (
      <StillHero venue={venue} cut={cut} label={label}>
        {children}
      </StillHero>
    );
  }
  return (
    <PlayingHero key={`${venue}-${cut}`} venue={venue} cut={cut} active={active} label={label}>
      {children}
    </PlayingHero>
  );
}

function StillHero({ venue, cut, label, children }: Omit<Props, 'reducedMotion' | 'active'>) {
  const media = lobbyHeroes[venue][cut];
  return (
    <View style={[styles.fill, { backgroundColor: lobbyHeroFill[venue] }]}>
      <Image source={media.poster} style={styles.media} resizeMode="cover" accessibilityLabel={label} />
      {children}
    </View>
  );
}

function PlayingHero({ venue, cut, active = true, label, children }: Omit<Props, 'reducedMotion'>) {
  const media = lobbyHeroes[venue][cut];
  const [shown, setShown] = useState(false);
  const player = useVideoPlayer(media.video, (next) => {
    next.loop = true;
    next.muted = true;
    next.volume = 0;
    next.audioMixingMode = 'mixWithOthers';
    next.showNowPlayingNotification = false;
    next.staysActiveInBackground = false;
  });

  useEffect(() => {
    let mounted = true;
    // pause/play throw once expo-video has released the native player on unmount.
    const safe = (run: () => void) => {
      if (!mounted) return;
      try {
        run();
      } catch {
        // Native player is already gone.
      }
    };
    const sync = () => {
      safe(() => {
        if (active && AppState.currentState === 'active') player.play();
        else player.pause();
      });
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [active, player]);

  return (
    <View style={[styles.fill, { backgroundColor: lobbyHeroFill[venue] }]}>
      <Image source={media.poster} style={styles.media} resizeMode="cover" accessibilityLabel={label} />
      <VideoView
        style={[styles.media, shown ? null : styles.hidden]}
        player={player}
        nativeControls={false}
        contentFit="cover"
        playsInline
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        allowsVideoFrameAnalysis={false}
        surfaceType="textureView"
        pointerEvents="none"
        accessible={false}
        onFirstFrameRender={() => setShown(true)}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  hidden: { opacity: 0 },
});
