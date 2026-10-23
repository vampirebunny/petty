import { phaseAfter, canShowTip, canOffer, phaseOnShow } from '../tipState';

describe('tip phases', () => {
  it('lets a dismissed tip show once more, then never again', () => {
    expect(phaseAfter(undefined, 'dismiss')).toBe('snoozed');
    expect(canShowTip('snoozed')).toBe(true);
    expect(phaseAfter('snoozed', 'dismiss')).toBe('done');
    expect(canShowTip('done')).toBe(false);
  });

  it('marks a tip seen when the player does the action', () => {
    expect(phaseAfter(undefined, 'act')).toBe('done');
    expect(phaseAfter('snoozed', 'act')).toBe('done');
    expect(phaseAfter('done', 'dismiss')).toBe('done');
  });

  it('retires the move tip the first time it is shown', () => {
    expect(phaseOnShow('tip.move', undefined)).toBe('done');
    expect(canOffer('tip.move', undefined)).toBe(true);
    expect(canOffer('tip.move', phaseOnShow('tip.move', undefined))).toBe(false);
    expect(canOffer('tip.move', 'snoozed')).toBe(false);
    expect(canOffer('tip.water', 'snoozed')).toBe(true);
    expect(phaseOnShow('tip.water', undefined)).toBeUndefined();
    expect(phaseOnShow('tip.food', 'snoozed')).toBe('snoozed');
  });
});
