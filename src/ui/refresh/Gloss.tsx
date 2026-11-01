import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ui } from './tokens';

export function Gloss({ radius }: { radius: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      <LinearGradient colors={[ui.gloss.top, ui.gloss.bottom]} style={[styles.band, { borderRadius: radius }]} />
      <View style={styles.spark} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 3,
    left: '6%',
    right: '6%',
    height: '48%',
  },
  spark: {
    position: 'absolute',
    top: '14%',
    left: '12%',
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: ui.gloss.spark,
    transform: [{ rotate: '-12deg' }],
  },
});
