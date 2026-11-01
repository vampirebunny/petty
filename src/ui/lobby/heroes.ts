import type { ImageSourcePropType } from 'react-native';

export type LobbyVenue = 'arcade' | 'catwalk' | 'stadium';
/** Phone banner is 700×360. The tall cut is 600×800 and fills the widescreen left pane. */
export type LobbyCut = 'phone' | 'tall';

export const lobbyPhoneAspect = 700 / 360;

export const lobbyHeroFill: Record<LobbyVenue, string> = {
  arcade: '#160F36',
  catwalk: '#3E2F6E',
  stadium: '#2E2470',
};

type HeroMedia = {
  video: number;
  poster: ImageSourcePropType;
};

export const lobbyHeroes: Record<LobbyVenue, Record<LobbyCut, HeroMedia>> = {
  arcade: {
    phone: {
      video: require('../../../assets/lobby/arcade-phone.mp4'),
      poster: require('../../../assets/lobby/arcade-phone.png'),
    },
    tall: {
      video: require('../../../assets/lobby/arcade-tall.mp4'),
      poster: require('../../../assets/lobby/arcade-tall.png'),
    },
  },
  catwalk: {
    phone: {
      video: require('../../../assets/lobby/catwalk-phone.mp4'),
      poster: require('../../../assets/lobby/catwalk-phone.png'),
    },
    tall: {
      video: require('../../../assets/lobby/catwalk-tall.mp4'),
      poster: require('../../../assets/lobby/catwalk-tall.png'),
    },
  },
  stadium: {
    phone: {
      video: require('../../../assets/lobby/stadium-phone.mp4'),
      poster: require('../../../assets/lobby/stadium-phone.png'),
    },
    tall: {
      video: require('../../../assets/lobby/stadium-tall.mp4'),
      poster: require('../../../assets/lobby/stadium-tall.png'),
    },
  },
};
