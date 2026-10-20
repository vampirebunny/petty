import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

// Short side of a tablet, spanned Duo, or unfolded foldable, in density-independent pixels.
const largeShortSide = 600;

// Phones stay portrait. A large window may rotate so the background can run edge to edge.
export function useDeviceOrientation() {
  const { width, height } = useWindowDimensions();
  const large = Math.min(width, height) >= largeShortSide;
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const portrait = !(Platform.OS === 'ios' && Platform.isPad) && !large;
    const apply = portrait
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      : ScreenOrientation.unlockAsync();
    void apply.catch(() => undefined);
  }, [large]);
}
