import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CloudHopScreen } from '../minigames/cloudHop/CloudHopScreen';
import { PaddlePawsScreen } from '../minigames/paddlePaws/PaddlePawsScreen';
import { StayScreen } from '../minigames/stay/StayScreen';
import type { PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { HandlePrompt } from '../ui/HandleScreen';
import { CloudHopIcon } from '../ui/places/cloudHopIcon';
import { PaddlePawsIcon } from '../ui/places/paddlePawsIcon';
import { StayIcon } from '../ui/places/stayIcon';
import { useContentWidth } from '../ui/PhoneColumn';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onClose: () => void;
};

export function ArcadeScreen({ pet, reducedMotion, onClose }: Props) {
  const [game, setGame] = useState<'hop' | 'paddle' | 'stay' | null>(null);
  const width = useContentWidth();
  const tile = Math.min(120, Math.max(84, (width - 56) / 3));

  if (game === 'hop') {
    return (
      <View style={styles.fill}>
        <CloudHopScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
        <HandlePrompt petName={pet.name} idle={false} />
      </View>
    );
  }

  if (game === 'paddle') {
    return (
      <View style={styles.fill}>
        <PaddlePawsScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
        <HandlePrompt petName={pet.name} idle={false} />
      </View>
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Leave" onPress={onClose} style={styles.back}>
            <Text style={styles.leave}>Leave</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>Arcade</Text>
            <Text style={styles.subtitle}>Pick a game for {pet.name}</Text>
          </View>
        </View>
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
      </ScrollView>
      <HandlePrompt petName={pet.name} idle={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, backgroundColor: '#F6F7FB', paddingTop: 64 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  back: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leave: { fontFamily: fontFamily.black, fontSize: 16, color: '#6B6F8A' },
  title: { fontFamily: fontFamily.black, fontSize: 28, color: '#2C2F4A' },
  subtitle: { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B6F8A' },
  grid: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, alignItems: 'center' },
  label: { marginTop: 8, fontFamily: fontFamily.black, fontSize: 16, lineHeight: 20, color: '#2C2F4A', textAlign: 'center' },
});
