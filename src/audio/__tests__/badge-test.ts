import { createAudioPlayer } from 'expo-audio';

import { playPointPop, releaseBadgeChime } from '../badge';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
  })),
}));

afterEach(() => {
  releaseBadgeChime();
  jest.clearAllMocks();
});

it('gives each point-add pop its own voice', () => {
  playPointPop();
  playPointPop();
  expect(createAudioPlayer).toHaveBeenCalledTimes(2);
});
