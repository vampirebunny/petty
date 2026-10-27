import { formatStayTime, gapOf, heldCentiseconds, isExactStay, keepCloser, pickTargetSeconds } from '../best';
import type { Attempt } from '../best';

const held = (targetCs: number, actualCs: number): Attempt => ({ targetCs, actualCs });

describe('stay', () => {
  it('picks a whole target from 5 through 15 seconds', () => {
    expect(pickTargetSeconds(0)).toBe(5);
    expect(pickTargetSeconds(0.999)).toBe(15);
    expect(pickTargetSeconds(10 / 11)).toBe(15);
    for (let step = 0; step < 11; step += 1) {
      expect(pickTargetSeconds(step / 11)).toBe(5 + step);
    }
  });

  it('keeps the closer attempt and leaves an equal gap alone', () => {
    const earlier = held(1000, 1004);
    const closer = held(800, 801);
    const sameGap = held(1200, 1204);
    const wider = held(500, 900);

    expect(gapOf(earlier)).toBe(4);
    expect(keepCloser(null, earlier)).toBe(earlier);
    expect(keepCloser(earlier, closer)).toBe(closer);
    expect(keepCloser(earlier, sameGap)).toBe(earlier);
    expect(keepCloser(earlier, wider)).toBe(earlier);
  });

  it('shows hundredths of a second', () => {
    expect(formatStayTime(1000)).toBe('10.00s');
    expect(formatStayTime(999)).toBe('9.99s');
  });

  it('treats a matching hundredth as exact', () => {
    expect(isExactStay(1000, 1000)).toBe(true);
    expect(isExactStay(1000, 1001)).toBe(false);
    expect(isExactStay(1000, 999)).toBe(false);
  });

  it('floors the hold to hundredths and caps the stored integer', () => {
    expect(heldCentiseconds(1_000, 1_000)).toBe(0);
    expect(heldCentiseconds(1_000, 1_259)).toBe(25);
    expect(heldCentiseconds(0, 30_000_000_000_000)).toBe(2_147_483_647);
  });
});
