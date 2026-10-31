import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type Props = {
  active: boolean;
  color?: string;
};

const heights = [10, 16, 12, 18];

export function SoundBars({ active, color = '#F5E9FF' }: Props) {
  const [anims] = useState(() => heights.map(() => new Animated.Value(0.35)));

  useEffect(() => {
    if (!active) {
      anims.forEach((value) => value.setValue(0.35));
      return;
    }
    const loops = anims.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 280 + index * 70,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.28,
            duration: 260 + index * 50,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, anims]);

  return (
    <View style={styles.row} accessibilityElementsHidden>
      {anims.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: heights[index],
              transform: [{ scaleY: value }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 18 },
  bar: { width: 3, borderRadius: 2 },
});
