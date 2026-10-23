import { petStyle } from '../../../actor/data/petStyle';
import { BELLY_AXIS_MIN, bellyAxisScale, bellyRollOf } from '../bellyRoll';

function bodyThickness(belly: number, girth: number): number {
  const roll = bellyRollOf(belly, girth);
  const axis = bellyAxisScale(roll);
  return Math.abs(axis * (roll.sil / axis));
}

describe('belly roll', () => {
  it('matches the side and belly-up poses at the ends of the turn', () => {
    const down = bellyRollOf(0, 0.7);
    const up = bellyRollOf(1, 0.7);
    expect(down.squash).toBeCloseTo(1);
    expect(down.sil).toBeCloseTo(1);
    expect(down.detail).toBe(1);
    expect(up.squash).toBeCloseTo(-1);
    expect(up.sil).toBeCloseTo(1);
    expect(up.detail).toBe(1);
    expect(bellyAxisScale(down)).toBeCloseTo(1);
    expect(bellyAxisScale(up)).toBeCloseTo(-1);
  });

  it('keeps the cross-section when the body is edge-on', () => {
    const girth = 0.7;
    const roll = bellyRollOf(0.5, girth);
    expect(roll.sil).toBeCloseTo(girth);
    expect(roll.detail).toBe(0);
    expect(Math.abs(bellyAxisScale(roll))).toBe(BELLY_AXIS_MIN);
    expect(bodyThickness(0.5, girth)).toBeCloseTo(girth);
  });

  it('never draws the torso thinner than its girth', () => {
    const girth = petStyle.roll.girth;
    for (let i = 0; i <= 20; i += 1) {
      expect(bodyThickness(i / 20, girth)).toBeGreaterThanOrEqual(girth - 1e-6);
    }
    const early = bellyRollOf(0.2, girth).sil;
    const mid = bellyRollOf(0.35, girth).sil;
    const edge = bellyRollOf(0.5, girth).sil;
    expect(early).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(edge);
  });

  it('fades side markings only while the flank is turning through', () => {
    const girth = 0.7;
    expect(bellyRollOf(0.25, girth).detail).toBe(1);
    const turning = bellyRollOf(0.4, girth).detail;
    expect(turning).toBeGreaterThan(0);
    expect(turning).toBeLessThan(1);
    expect(bellyRollOf(0.6, girth).detail).toBeCloseTo(turning);
  });
});
