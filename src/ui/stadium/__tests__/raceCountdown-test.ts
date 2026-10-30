import { countBeat, countLabelFor, raceInputOpen } from '../raceCountdown';

describe('race countdown', () => {
  it('steps Get ready, 3, 2, 1, then Go for one second', () => {
    expect(countBeat(4001)).toBeNull();
    expect(countLabelFor(4000)).toBe('Get ready!');
    expect(countBeat(3000)).toBe(3);
    expect(countLabelFor(3000)).toBe('3');
    expect(countLabelFor(2000)).toBe('2');
    expect(countLabelFor(1000)).toBe('1');
    expect(countBeat(0)).toBe(0);
    expect(countLabelFor(-999)).toBe('Go!');
    expect(countBeat(-1000)).toBeNull();
  });

  it('accepts a tap only at Go and drops it after the finish', () => {
    const start = 10_000;
    expect(raceInputOpen(start - 1, start, false)).toBe(false);
    expect(raceInputOpen(start, start, false)).toBe(true);
    expect(raceInputOpen(start + 40, start, false)).toBe(true);
    expect(raceInputOpen(start + 40, start, true)).toBe(false);
  });
});
