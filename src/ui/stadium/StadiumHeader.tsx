import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { formatSlot } from '../../sim/stadium';
import { fontFamily } from '../font';
import { LobbyHero } from '../lobby/LobbyHero';
import { isLandscapeSplit } from '../wideLayout';

type Props = {
  nextStart: number | null;
  reducedMotion: boolean;
  /** False once this lobby is no longer the screen being shown. */
  active?: boolean;
};

export function StadiumHeader({ nextStart, reducedMotion, active = true }: Props) {
  const { width, height } = useWindowDimensions();
  const tall = isLandscapeSplit(width, height);
  const when = nextStart ? formatSlot(nextStart) : '--:--';
  return (
    <LobbyHero venue="stadium" cut={tall ? 'tall' : 'phone'} reducedMotion={reducedMotion} active={active} label="A lit stadium">
      <View pointerEvents="none" style={[styles.copy, tall ? styles.copyTall : styles.copyPhone]}>
        <Text accessibilityRole="header" style={styles.title}>
          Stadium
        </Text>
        <Text style={styles.next}>Next race {when}</Text>
      </View>
    </LobbyHero>
  );
}

const styles = StyleSheet.create({
  copy: {
    position: 'absolute',
    left: 76,
    right: 76,
    alignItems: 'center',
  },
  copyPhone: { top: 54 },
  copyTall: { top: 64 },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 28,
    color: '#FFFFFF',
    textShadowColor: '#3A2A78',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  next: {
    marginTop: 2,
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#FFE08A',
    textShadowColor: '#3A2A78',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});
