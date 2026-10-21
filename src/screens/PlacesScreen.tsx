import { useId } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { scenesFor } from '../actor';
import type { Scene } from '../actor';
import { placeFlavors, placeIcons } from '../ui/actionIcons';
import { CandyShell, GRAY, Sparkle, WHITE, candyInk, tints } from '../ui/candy';
import type { Tint } from '../ui/candy';
import { iconStroke } from '../ui/theme';

type Props = {
  species: 'dog' | 'cat';
  currentSceneId: string;
  petName: string;
  onPick: (sceneId: string) => void;
  onClose: () => void;
  reducedMotion: boolean;
};

export function PlacesScreen({ species, currentSceneId, petName, onPick, onClose }: Props) {
  const backUid = useId().replace(/:/g, '');
  const places = scenesFor(species).filter((scene) => scene.group === 'home');
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
            {({ pressed }) => (
              <CandyShell tint={GRAY} radius={16} pressed={pressed} uid={backUid} style={styles.backFace}>
                <ChevronLeft size={22} strokeWidth={iconStroke + 1} color={GRAY.icon} />
              </CandyShell>
            )}
          </Pressable>
          <View style={styles.titles}>
            <Text style={styles.title}>Where to?</Text>
            <Text style={styles.subtitle}>Pick a spot for {petName}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {places.map((scene) => (
            <PlaceCard
              key={scene.id}
              scene={scene}
              current={scene.id === currentSceneId}
              onPress={() => {
                if (scene.id !== currentSceneId) {
                  onPick(scene.id);
                }
                onClose();
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PlaceCard({ scene, current, onPress }: { scene: Scene; current: boolean; onPress: () => void }) {
  const uid = useId().replace(/:/g, '');
  const flavor = placeFlavors[scene.iconId ?? scene.id] ?? 'peach';
  const tint = tints[flavor];
  const Icon = placeIcons[scene.iconId ?? scene.id] ?? placeIcons.livingroom;
  const ink = candyInk(tint);
  return (
    <Pressable
      style={styles.cardHit}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      accessibilityLabel={current ? `${scene.name}. You are here` : scene.name}
    >
      {({ pressed }) => (
        <CandyShell tint={tint} radius={28} selected={current} pressed={pressed} uid={uid} style={styles.card}>
          <IconBubble tint={tint} Icon={Icon} />
          <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
            {scene.name}
          </Text>
          {scene.blurb ? (
            <Text style={[styles.blurb, { color: ink }]} numberOfLines={2}>
              {scene.blurb}
            </Text>
          ) : null}
          {current ? (
            <View style={styles.sticker}>
              <Text style={[styles.stickerText, { color: ink }]}>{'You\u2019re here'}</Text>
            </View>
          ) : (
            <Sparkle style={styles.sparkle} opacity={0.9} />
          )}
        </CandyShell>
      )}
    </Pressable>
  );
}

function IconBubble({ tint, Icon }: { tint: Tint; Icon: (typeof placeIcons)['livingroom'] }) {
  return (
    <View style={[styles.bubble, { shadowColor: tint.lip }]}>
      <Icon size={30} strokeWidth={iconStroke + 1} color={tint.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingTop: 64,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backHit: {
    width: 44,
  },
  backFace: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#243044',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C6B80',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 18,
  },
  cardHit: {
    width: '47%',
  },
  card: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  blurb: {
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  sticker: {
    position: 'absolute',
    top: 10,
    right: 8,
    backgroundColor: WHITE,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stickerText: {
    fontSize: 10,
    fontWeight: '900',
  },
  sparkle: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 10,
    height: 10,
  },
});
