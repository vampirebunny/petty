import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { switchTrack } from '../candyTokens';

export function CandySwitch({ on }: { on: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <View style={[styles.track, { backgroundColor: on ? 'transparent' : switchTrack.off }]}>
      {on ? (
        <Svg width={switchTrack.width} height={switchTrack.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`sw${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={switchTrack.on[0]} />
              <Stop offset="1" stopColor={switchTrack.on[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={switchTrack.width} height={switchTrack.height} rx={12} fill={`url(#sw${uid})`} />
        </Svg>
      ) : null}
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: switchTrack.width,
    height: switchTrack.height,
    borderRadius: switchTrack.height / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: switchTrack.knob,
    height: switchTrack.knob,
    borderRadius: switchTrack.knob / 2,
    backgroundColor: '#FFFFFF',
    top: (switchTrack.height - switchTrack.knob) / 2,
  },
  knobOn: {
    left: switchTrack.width - switchTrack.knob - 3,
  },
  knobOff: {
    left: 3,
  },
});
