import { createAudioPlayer } from 'expo-audio';

import { playVoice } from '../voice';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

const placeholders = [
  'cuddle_sneeze',
  'cuddle_purr_loop',
  'cuddle_content_sigh',
  'cuddle_whimper_happy',
  'cuddle_shake_off',
  'cuddle_swat',
  'cuddle_flinch_chirp',
  'cuddle_kneading_loop',
] as const;

it('stays silent for Cuddle sounds that have no clip yet', () => {
  for (const sound of placeholders) {
    expect(() => playVoice({ actorId: 'pet', sound, rate: 1 })).not.toThrow();
  }
  expect(createAudioPlayer).not.toHaveBeenCalled();
});
