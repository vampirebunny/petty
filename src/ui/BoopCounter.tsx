import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  value: number;
  pulse: number;
};

export function BoopCounter({ value, pulse }: Props) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const pulseRef = useRef(pulse);

  useEffect(() => {
    const from = shownRef.current;
    const rising = pulse !== pulseRef.current && value > from;
    pulseRef.current = pulse;
    if (!rising) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / 600);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pulse, value]);

  return (
    <View style={styles.wrap} accessibilityLabel={`${shown} Boops`}>
      <Text style={styles.value}>{shown}</Text>
      <Text style={styles.label}>Boops</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    top: 0,
    minWidth: 64,
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 20,
    fontWeight: '900',
    color: '#243044',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5C6B80',
  },
});
