import { createAudioPlayer } from 'expo-audio';

import { playVoice, releaseVoices } from '../voice';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    pause: jest.fn(),
    play: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setPlaybackRate: jest.fn(),
    release: jest.fn(),
    shouldCorrectPitch: false,
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

afterEach(() => {
  releaseVoices();
  jest.clearAllMocks();
});

it('plays the cuddle purr and happy bark clips', () => {
  playVoice({ actorId: 'pet', sound: 'cuddle_purr', rate: 1 });
  playVoice({ actorId: 'pet', sound: 'cuddle_happy', rate: 1 });
  expect(createAudioPlayer).toHaveBeenCalledTimes(4);
});
