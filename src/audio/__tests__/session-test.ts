import { setAudioModeAsync } from 'expo-audio';

import { configurePlayback, restoreAfterVideoSession } from '../session';

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

const setMode = jest.mocked(setAudioModeAsync);

beforeEach(() => {
  setMode.mockReset();
  setMode.mockImplementation(() => Promise.resolve());
});

it('puts the silent switch back on a later configure', async () => {
  await configurePlayback();
  await configurePlayback();
  expect(setMode).toHaveBeenCalledTimes(2);
  expect(setMode).toHaveBeenCalledWith({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
});

it('runs once more when configure is asked for during an in-flight call', async () => {
  let release: () => void = () => {};
  setMode.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const first = configurePlayback();
  void configurePlayback();
  expect(setMode).toHaveBeenCalledTimes(1);
  release();
  await first;
  await Promise.resolve();
  expect(setMode).toHaveBeenCalledTimes(2);
});

it('waits out the video session write, and keeps only the latest restore', async () => {
  jest.useFakeTimers();
  try {
    restoreAfterVideoSession();
    restoreAfterVideoSession();
    expect(setMode).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(setMode).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
