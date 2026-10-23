import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { isLargeWindow } from './wideLayout';

// Phones stay portrait. A large window may rotate. Landscape home splits the scene and the controls.
export function useDeviceOrientation() {
  const { width, height } = useWindowDimensions();
  const large = isLargeWindow(width, height);
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
