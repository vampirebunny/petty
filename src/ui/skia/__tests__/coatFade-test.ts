import { coatWeights } from '../coatFade';

describe('coat crossfade', () => {
  it('keeps a settled back view on the back panel and the back leg slot', () => {
    const weights = coatWeights('NW', 'N', 1);
    expect(weights.back).toBe(1);
    expect(weights.side).toBe(0);
    expect(weights.legsInBackPass).toBe(true);
  });

  it('crossfades into full back and moves the legs for the whole blend', () => {
    const weights = coatWeights('NW', 'N', 0.4);
    expect(weights.side).toBeCloseTo(0.6);
    expect(weights.back).toBeCloseTo(0.4);
    expect(weights.legsInBackPass).toBe(true);
  });

  it('crossfades out of full back', () => {
    const weights = coatWeights('N', 'NW', 0.4);
    expect(weights.back).toBeCloseTo(0.6);
    expect(weights.side).toBeCloseTo(0.4);
    expect(weights.legsInBackPass).toBe(true);
  });

  it('does not keep the back leg slot after the pet has settled on back 3/4', () => {
    const weights = coatWeights('N', 'NW', 1);
    expect(weights.back).toBe(0);
    expect(weights.side).toBe(1);
    expect(weights.legsInBackPass).toBe(false);
  });

  it('does not crossfade between side and 3/4', () => {
    expect(coatWeights('E', 'SE', 0.5)).toEqual({ side: 1, front: 0, back: 0, legsInBackPass: false });
  });

  it('crossfades the side coat into the front panel', () => {
    const weights = coatWeights('SE', 'S', 0.25);
    expect(weights.side).toBeCloseTo(0.75);
    expect(weights.front).toBeCloseTo(0.25);
    expect(weights.legsInBackPass).toBe(false);
  });
});
