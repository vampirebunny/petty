import { phaseAfter, canShowTip } from '../tipState';

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
});
