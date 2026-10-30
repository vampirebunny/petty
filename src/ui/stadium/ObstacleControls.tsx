import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import type { ObstacleButton } from '../../../supabase/functions/_shared/race-sim/index.ts';
import { tints } from '../candy';
import { fontFamily } from '../font';
import { ink, shared } from './parts';

type Props = {
  going: boolean;
  beat: number | null;
  countLabel: string | null;
  hint: string;
  /** The button the next obstacle needs; it glows. RUN never cues — keep tapping it. */
  cue: ObstacleButton | null;
  onPress: (button: ObstacleButton) => void;
};

type Rect = { x: number; y: number; width: number; height: number };
type Touch = GestureResponderEvent['nativeEvent'];

const slopPx = 8;

function inside(rect: Rect, touch: Touch): boolean {
  return (
    touch.pageX >= rect.x - slopPx &&
    touch.pageX <= rect.x + rect.width + slopPx &&
    touch.pageY >= rect.y - slopPx &&
    touch.pageY <= rect.y + rect.height + slopPx
  );
}

// Fires once per new finger on this button, so a held thumb doesn't repeat and two thumbs on two buttons both count.
// Fingers that land together reach every touched button in one `changedTouches` list, so keep only this button's.
function useTouchTarget(onStart: () => void) {
  const touched = useRef(new Set<string>());
  const ref = useRef<View>(null);
  const rect = useRef<Rect | null>(null);
  const ownTouches = (event: GestureResponderEvent): Touch[] => {
    const changed = event.nativeEvent.changedTouches ?? [];
    if (changed.length <= 1) return changed;
    const bounds = rect.current;
    const mine = bounds ? changed.filter((touch) => inside(bounds, touch)) : [];
    if (mine.length > 0) return mine;
    return changed.filter((touch) => touch.identifier === event.nativeEvent.identifier).slice(0, 1);
  };
  return {
    ref,
    onLayout: () => {
      ref.current?.measureInWindow((x, y, width, height) => {
        rect.current = { x, y, width, height };
      });
    },
    onTouchStart: (event: GestureResponderEvent) => {
      for (const touch of ownTouches(event)) {
        const id = String(touch.identifier);
        if (!touched.current.has(id)) {
          touched.current.add(id);
          onStart();
        }
      }
    },
    onTouchEnd: (event: GestureResponderEvent) => {
      for (const touch of event.nativeEvent.changedTouches ?? []) {
        touched.current.delete(String(touch.identifier));
      }
    },
    onTouchCancel: () => touched.current.clear(),
  };
}

function Pill({
  label,
  arrow,
  going,
  glow,
  style,
  onPress,
}: {
  label: string;
  arrow: string;
  going: boolean;
  glow: boolean;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const touch = useTouchTarget(onPress);
  return (
    <View
      {...touch}
      style={[styles.pill, style, glow && going && styles.glow, !going && styles.wait]}
      accessibilityRole="button"
      accessibilityLabel={going ? label : 'Wait for Go'}
      accessibilityState={{ disabled: !going }}
    >
      {going ? <Text style={styles.arrow}>{arrow}</Text> : null}
      <Text style={[styles.pillLabel, !going && styles.waitLabel]}>{going ? label : 'Wait'}</Text>
    </View>
  );
}

function RunPad({ going, onPress }: { going: boolean; onPress: () => void }) {
  const touch = useTouchTarget(onPress);
  return (
    <View
      {...touch}
      style={[styles.run, !going && styles.waitRun]}
      accessibilityRole="button"
      accessibilityLabel={going ? 'Run' : 'Wait for Go'}
      accessibilityState={{ disabled: !going }}
    >
      <Text style={[styles.runLabel, !going && styles.waitLabel]}>{going ? 'RUN' : 'Wait'}</Text>
    </View>
  );
}

// JUMP and DUCK stacked under the left thumb; big RUN under the right. Keep tapping RUN for speed.
export function ObstacleControls({ going, beat, countLabel, hint, cue, onPress }: Props) {
  return (
    <View style={styles.action}>
      {countLabel ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.count, beat === 4 && styles.ready, beat === 0 && styles.go]}>
          {countLabel}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.stack}>
          <Pill label="JUMP" arrow="↑" going={going} glow={cue === 'jump'} style={styles.jump} onPress={() => onPress('jump')} />
          <Pill label="DUCK" arrow="↓" going={going} glow={cue === 'duck'} style={styles.duck} onPress={() => onPress('duck')} />
        </View>
        <RunPad going={going} onPress={() => onPress('run')} />
      </View>
      <Text style={shared.copy}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  count: { fontFamily: fontFamily.fredokaBold, fontSize: 56, color: ink },
  ready: { fontSize: 38 },
  go: { color: tints.mint.icon },
  row: { alignSelf: 'stretch', flexDirection: 'row', gap: 14, alignItems: 'stretch' },
  stack: { flex: 1, gap: 10 },
  pill: {
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  jump: { backgroundColor: tints.mint.icon },
  duck: { backgroundColor: tints.lilac.icon },
  run: {
    width: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: ink,
    backgroundColor: tints.pink.icon,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  waitRun: { backgroundColor: '#E4DEE9', borderColor: '#B7ADC1', borderStyle: 'dashed', opacity: 0.6, transform: [{ scale: 0.92 }] },
  glow: { shadowColor: '#FFF3A0', shadowOpacity: 1, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10, borderColor: '#FFE45C' },
  wait: { backgroundColor: '#E4DEE9', borderColor: '#B7ADC1', borderStyle: 'dashed', opacity: 0.6, transform: [{ scale: 0.92 }] },
  arrow: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: '#fff' },
  pillLabel: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: '#fff' },
  runLabel: { fontFamily: fontFamily.fredokaBold, fontSize: 30, color: '#fff' },
  waitLabel: { color: '#9A8FA6' },
});
