import type { ImageSourcePropType } from 'react-native';

export type StadiumCut = 'phone' | 'tall';

// The poster with the night sky removed. `skyBottom` is the lowest transparent row, in image pixels.
export const stadiumPlates: Record<
  StadiumCut,
  { art: ImageSourcePropType; lights: ImageSourcePropType; width: number; height: number; skyBottom: number }
> = {
  phone: {
    art: require('../../../assets/lobby/stadium-phone-plate.png'),
    lights: require('../../../assets/lobby/stadium-phone-lights.png'),
    width: 1400,
    height: 720,
    skyBottom: 282,
  },
  tall: {
    art: require('../../../assets/lobby/stadium-tall-plate.png'),
    lights: require('../../../assets/lobby/stadium-tall-lights.png'),
    width: 1200,
    height: 1600,
    skyBottom: 702,
  },
};
