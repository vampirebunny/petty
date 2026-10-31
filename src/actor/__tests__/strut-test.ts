import { runwaySteps, strutCadenceHz, strutDef, strutFoot, strutForeLift, strutForeSwing } from '../data/strut';

describe('strut', () => {
  it('keeps a longer stride and higher fore lift than the walk', () => {
    expect(strutDef.stride).toBeGreaterThan(0.38);
    expect(strutForeLift).toBeGreaterThan(strutDef.lift);
    expect(strutCadenceHz).toBe(1);
  });

  it('returns a planted foot and a lifted swing foot', () => {
    const planted = strutFoot(0, 0, 40);
    expect(planted.y).toBe(0);
    const swing = strutFoot(1, Math.PI, 40);
    expect(swing.y).toBeLessThan(0);
  });

  it('eases the fore swing past the linear path', () => {
    expect(strutForeSwing(0)).toBeLessThan(0.2);
    expect(strutForeSwing(1)).toBeCloseTo(1, 5);
  });

  it('lists the runway beats', () => {
    expect(runwaySteps.map((step) => step.id)).toEqual(['enter', 'walkOut', 'stop', 'pose', 'turn', 'walkBack', 'exit']);
  });
});
