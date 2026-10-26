import { createAudioPlayer } from 'expo-audio';

import { pauseArcadeRound, resumeArcadeRound, startArcadeRound, stopArcadeRound } from '../arcadeMusic';
import { releaseMusic, setMusicEnabled } from '../music';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

function fakePlayer() {
  return {
    volume: 1,
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
}

beforeEach(() => {
  jest.mocked(createAudioPlayer).mockImplementation(() => fakePlayer() as never);
});

afterEach(() => {
  stopArcadeRound();
  releaseMusic();
});

it('stays quiet while music is off', () => {
  setMusicEnabled(false);
  const before = jest.mocked(createAudioPlayer).mock.calls.length;
  startArcadeRound();
  expect(jest.mocked(createAudioPlayer).mock.calls.length).toBe(before);
});

it('loops one track for the round and picks another track on the next start', () => {
  setMusicEnabled(true);
  const sceneCalls = jest.mocked(createAudioPlayer).mock.calls.length;
  startArcadeRound();
  const first = jest.mocked(createAudioPlayer).mock.results.at(-1)?.value as ReturnType<typeof fakePlayer>;
  expect(first.loop).toBe(true);
  expect(first.play).toHaveBeenCalledTimes(1);
  expect(jest.mocked(createAudioPlayer).mock.calls.length).toBe(sceneCalls + 1);

  pauseArcadeRound();
  expect(first.pause).toHaveBeenCalled();
  resumeArcadeRound();
  expect(first.play).toHaveBeenCalledTimes(2);
  expect(jest.mocked(createAudioPlayer).mock.calls.length).toBe(sceneCalls + 1);

  startArcadeRound();
  expect(first.release).toHaveBeenCalled();
  const second = jest.mocked(createAudioPlayer).mock.results.at(-1)?.value as ReturnType<typeof fakePlayer>;
  expect(second.loop).toBe(true);
  expect(jest.mocked(createAudioPlayer).mock.calls.length).toBe(sceneCalls + 2);

  stopArcadeRound();
  expect(second.release).toHaveBeenCalled();
});

it('quiets scene music for the round and brings it back when the round ends', () => {
  setMusicEnabled(true);
  const scene = jest.mocked(createAudioPlayer).mock.results.at(-1)?.value as ReturnType<typeof fakePlayer>;
  startArcadeRound();
  expect(scene.pause).toHaveBeenCalled();
  stopArcadeRound();
  expect(scene.play).toHaveBeenCalled();
});
