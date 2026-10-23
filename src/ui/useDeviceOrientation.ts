import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { allowsDeviceRotation, isSurfaceDuoModel } from './wideLayout';

// Phones stay portrait. iPad, a window at least 520dp on the short side, and Surface Duo may rotate.
// On Android, unspecified orientation falls back to the portrait setting baked into the install, which
// letterboxes an opened Duo. Full sensor overrides that.
export function useDeviceOrientation() {
  const { width, height } = useWindowDimensions();
  const duo =
    Platform.OS === 'android' &&
    isSurfaceDuoModel(
      Platform.constants.Model,
      Platform.constants.Manufacturer,
      `${Platform.constants.Brand} ${Platform.constants.Fingerprint}`,
    );
  const rotate = (Platform.OS === 'ios' && Platform.isPad) || duo || allowsDeviceRotation(width, height);
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const apply = rotate
      ? Platform.OS === 'android'
        ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL)
        : ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    void apply.catch(() => undefined);
  }, [rotate]);
}
