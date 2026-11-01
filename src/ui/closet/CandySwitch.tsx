import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { switchTrack } from '../candyTokens';

export function CandySwitch({ on }: { on: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <View style={[styles.track, { backgroundColor: on ? 'transparent' : switchTrack.off }]}>
      <Svg width={switchTrack.width} height={switchTrack.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`sw${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={switchTrack.on[0]} />
            <Stop offset="1" stopColor={switchTrack.on[1]} />
          </LinearGradient>
          <LinearGradient id={`gl${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {on ? <Rect x="0" y="0" width={switchTrack.width} height={switchTrack.height} rx={12} fill={`url(#sw${uid})`} /> : null}
        <Rect x="4" y="2" width={switchTrack.width - 8} height={switchTrack.height * 0.45} rx={5} fill={`url(#gl${uid})`} />
      </Svg>
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]}>
        <View style={styles.knobShine} />
      </View>
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  knob: {
    position: 'absolute',
    width: switchTrack.knob,
    height: switchTrack.knob,
    borderRadius: switchTrack.knob / 2,
    backgroundColor: '#FFFFFF',
    top: (switchTrack.height - 2 - switchTrack.knob) / 2,
    shadowColor: '#7853E6',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  knobShine: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 7,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDE6FF',
  },
  knobOn: {
    left: switchTrack.width - 2 - switchTrack.knob - 3,
  },
  knobOff: {
    left: 3,
  },
});
