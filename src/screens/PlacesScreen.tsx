import { useId } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { fontFamily } from '../ui/font';
import { useContentWidth } from '../ui/PhoneColumn';
import { LocationButton } from '../ui/places/LocationButton';
import { locationIcons } from '../ui/places/locationIcons';
import { spotsFor } from '../ui/places/spots';

type Props = {
  species: 'dog' | 'cat';
  currentSceneId: string;
  petName: string;
  onPick: (sceneId: string) => void;
  onClose: () => void;
  onShop: () => void;
  onArcade: () => void;
  reducedMotion: boolean;
};

export function PlacesScreen({ species, currentSceneId, petName, onPick, onClose, onShop, onArcade, reducedMotion }: Props) {
  const width = useContentWidth();
  const column = Math.max(0, (width - 12 * 2 - 8) / 2);
  const iconSize = Math.min(132, column);
  const spots = spotsFor(species);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <BackButton onPress={onClose} />
          <View style={styles.titles}>
            <Text style={styles.title}>Where to?</Text>
            <Text style={styles.subtitle}>Pick a spot for {petName}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {spots.map((spot, index) => {
            const Icon = locationIcons[spot.id];
            return (
              <View key={spot.id} style={[styles.cell, { width: column }]}>
                <LocationButton
                  label={spot.label}
                  Icon={Icon}
                  size={iconSize}
                  bobIndex={index}
                  isCurrent={spot.sceneId != null && spot.sceneId === currentSceneId}
                  reducedMotion={reducedMotion}
                  onPress={() => {
                    if (spot.dest === 'shop') {
                      onShop();
                      return;
                    }
                    if (spot.dest === 'arcade') {
                      onArcade();
                      return;
                    }
                    if (spot.sceneId != null && spot.sceneId !== currentSceneId) {
                      onPick(spot.sceneId);
                    }
                    onClose();
                  }}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const id = `back${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.backHit}>
      {({ pressed }) => (
        <View style={styles.backWrap}>
          <View style={styles.backLip} />
          <View style={[styles.backFace, pressed && styles.backPressed]}>
            <Svg width={48} height={48} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="48">
                  <Stop offset="0" stopColor="#FFFFFF" />
                  <Stop offset="1" stopColor="#E6E8F1" />
                </LinearGradient>
              </Defs>
              <Circle cx={24} cy={24} r={24} fill={`url(#${id})`} />
            </Svg>
            <ChevronLeft size={24} strokeWidth={3} color="#6B6F8A" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F6F7FB',
    paddingTop: 64,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backHit: {
    width: 48,
    height: 52,
  },
  backWrap: {
    width: 48,
    height: 52,
  },
  backLip: {
    position: 'absolute',
    top: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CACDDC',
  },
  backFace: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#282C50',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  backPressed: {
    transform: [{ translateY: 2 }],
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.black,
    fontSize: 34,
    letterSpacing: -0.5,
    color: '#2C2F4A',
  },
  subtitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#6B6F8A',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 30,
    paddingTop: 36,
  },
  cell: {
    alignItems: 'center',
  },
});
