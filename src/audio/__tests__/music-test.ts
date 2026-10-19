import { pickNext } from '../music';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

it('never repeats the previous track and stays in range', () => {
  for (let prev = -1; prev < 12; prev += 1) {
    for (let i = 0; i < 300; i += 1) {
      const next = pickNext(12, prev);
      expect(next).not.toBe(prev);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(12);
    }
  }
});

it('reaches every other track', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 12; i += 1) {
    seen.add(pickNext(12, 3, () => i / 12));
  }
  expect(seen.has(3)).toBe(false);
  expect(seen.size).toBe(11);
});

it('handles a single track', () => {
  expect(pickNext(1, 0)).toBe(0);
});
