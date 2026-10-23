import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { controlScale } from './wideLayout';

// Lays children out at designWidth and scales that box down to the measured frame.
// A full-size column is unchanged. A narrower one keeps every control on screen.
export function FitScale({
  designWidth,
  style,
  children,
}: {
  designWidth: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const scale = controlScale(box.width, designWidth);
  const fitted = box.width > 0 && box.height > 0 && scale < 0.999;
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    const height = Math.round(event.nativeEvent.layout.height);
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  return (
    <View style={style} onLayout={onLayout}>
      <View style={fitted ? { width: box.width, height: box.height, overflow: 'hidden' } : styles.fill}>
        <View
          style={
            fitted
              ? {
                  width: designWidth,
                  height: box.height / scale,
                  transform: [{ scale }],
                  transformOrigin: 'left top',
                }
              : styles.fill
          }
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 0,
  },
});
