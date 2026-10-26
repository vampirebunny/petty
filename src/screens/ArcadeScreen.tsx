import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CloudHopScreen } from '../minigames/cloudHop/CloudHopScreen';
import type { PetState } from '../sim/types';
import { fontFamily } from '../ui/font';
import { HandlePrompt } from '../ui/HandleScreen';
import { CloudHopIcon } from '../ui/places/cloudHopIcon';
import { useContentWidth } from '../ui/PhoneColumn';

type Props = {
  pet: PetState;
  reducedMotion: boolean;
  onClose: () => void;
};

export function ArcadeScreen({ pet, reducedMotion, onClose }: Props) {
  const [game, setGame] = useState<'hop' | null>(null);
  const width = useContentWidth();
  const tile = Math.min(148, Math.max(96, (width - 48) / 2));

  if (game === 'hop') {
    return (
      <View style={styles.fill}>
        <CloudHopScreen pet={pet} reducedMotion={reducedMotion} onBack={() => setGame(null)} onMenu={() => setGame(null)} />
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
          <View accessibilityRole="text" accessibilityLabel="Paddle Paws" style={[styles.tile, styles.soon]}>
            <View style={[styles.placeholder, { width: tile, height: tile }]}>
              <View style={[styles.paddle, styles.paddleLeft]} />
              <View style={[styles.paddle, styles.paddleRight]} />
            </View>
            <Text style={styles.label}>Paddle Paws</Text>
          </View>
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
  soon: { opacity: 0.45 },
  label: { marginTop: 8, fontFamily: fontFamily.black, fontSize: 20, color: '#2C2F4A', textAlign: 'center' },
  placeholder: {
    borderRadius: 24,
    backgroundColor: '#E7E4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paddle: {
    position: 'absolute',
    width: 14,
    height: '46%',
    borderRadius: 8,
  },
  paddleLeft: { left: '22%', backgroundColor: '#F08AB8' },
  paddleRight: { right: '22%', backgroundColor: '#8FD0FF' },
});
