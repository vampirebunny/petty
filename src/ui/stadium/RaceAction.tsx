import { useRef } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tints } from '../candy';
import { fontFamily } from '../font';
import { ink, shared } from './parts';

export type RaceActionTone = 'tap' | 'jump';

type Props = {
  going: boolean;
  beat: number | null;
  countLabel: string | null;
  activeLabel: string;
  tone: RaceActionTone;
  hint: string;
  accessibilityLabel: string;
  onActivate: () => void;
  children?: ReactNode;
};

export function RaceAction({
  going,
  beat,
  countLabel,
  activeLabel,
  tone,
  hint,
  accessibilityLabel,
  onActivate,
  children,
}: Props) {
  const touched = useRef(new Set<string>());

  return (
    <View
      style={styles.action}
      onTouchStart={(event) => {
        for (const touch of event.nativeEvent.touches) {
          const id = String(touch.identifier);
          if (!touched.current.has(id)) {
            touched.current.add(id);
            onActivate();
          }
        }
      }}
      onTouchEnd={(event) => {
        for (const touch of event.nativeEvent.changedTouches ?? []) {
          touched.current.delete(String(touch.identifier));
        }
        const still = new Set(event.nativeEvent.touches.map((touch) => String(touch.identifier)));
        for (const id of touched.current) {
          if (!still.has(id)) touched.current.delete(id);
        }
      }}
      onTouchCancel={() => touched.current.clear()}
    >
      {countLabel ? (
        <Text accessibilityLiveRegion="assertive" style={[styles.count, beat === 4 && styles.ready, beat === 0 && styles.go]}>
          {countLabel}
        </Text>
      ) : null}
      {children}
      <View
        style={[styles.control, tone === 'jump' ? styles.jump : styles.tap, !going && styles.wait]}
        accessibilityRole="button"
        accessibilityLabel={going ? accessibilityLabel : 'Wait for Go'}
        accessibilityState={{ disabled: !going }}
      >
        {tone === 'jump' && going ? <Text style={styles.arrow}>↑</Text> : null}
        <Text style={[styles.label, tone === 'jump' && going && styles.jumpLabel, !going && styles.waitLabel]}>
          {going ? activeLabel : 'Wait'}
        </Text>
      </View>
      <Text style={shared.copy}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  count: { fontFamily: fontFamily.fredokaBold, fontSize: 72, color: ink },
  ready: { fontSize: 44 },
  go: { color: tints.mint.icon },
  control: { borderWidth: 3, borderColor: ink, alignItems: 'center', justifyContent: 'center' },
  tap: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#FF8FC0' },
  jump: {
    minWidth: 220,
    height: 88,
    paddingHorizontal: 28,
    borderRadius: 44,
    backgroundColor: tints.mint.icon,
    flexDirection: 'row',
    gap: 8,
  },
  wait: { backgroundColor: '#E4DEE9', borderColor: '#B7ADC1', borderStyle: 'dashed', opacity: 0.6, transform: [{ scale: 0.92 }] },
  label: { fontFamily: fontFamily.fredokaBold, fontSize: 36, color: '#fff' },
  jumpLabel: { fontSize: 32 },
  waitLabel: { color: '#9A8FA6' },
  arrow: { fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#fff' },
});
