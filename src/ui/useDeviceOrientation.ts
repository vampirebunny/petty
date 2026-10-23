import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { allowsDeviceRotation, duoOpenedBoopEdge, duoOpenedTopInset, isSurfaceDuoModel, looksSpannedDuo } from './wideLayout';

function surfaceDuo(width: number, height: number): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  if (
    isSurfaceDuoModel(
      Platform.constants.Model,
      Platform.constants.Manufacturer,
      `${Platform.constants.Brand} ${Platform.constants.Fingerprint}`,
    )
  ) {
    return true;
  }
  return looksSpannedDuo(width, height);
}

// Extra top space so the Boop total clears the status icons on an opened Duo.
export function useOpenedDuoTopInset(): number {
  const { width, height } = useWindowDimensions();
  return duoOpenedTopInset(surfaceDuo(width, height), width, height);
}

// Distance from the right edge for the Boop total. An opened Duo keeps it clear of the status icons.
export function useOpenedDuoBoopEdge(): number {
  const { width, height } = useWindowDimensions();
  return duoOpenedBoopEdge(Platform.OS, width, height);
}

// Phones stay portrait. iPad, a window at least 520dp on the short side, and Surface Duo may rotate.
// On Android, unspecified orientation falls back to the portrait setting baked into the install, which
// letterboxes an opened Duo. Full sensor overrides that. iOS orientations live in Info.plist: calling
// lockAsync sets UIDevice.orientation, which UIKit rejects.
export function useDeviceOrientation() {
  const { width, height } = useWindowDimensions();
  const duo = surfaceDuo(width, height);
  const rotate = (Platform.OS === 'ios' && Platform.isPad) || duo || allowsDeviceRotation(width, height);
  useEffect(() => {
    if (Platform.OS === 'web' || Platform.OS === 'ios') {
      return;
    }
    const apply = rotate
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL)
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    void apply.catch(() => undefined);
  }, [rotate]);
}
