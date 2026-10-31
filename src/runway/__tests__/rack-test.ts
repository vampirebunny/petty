import { allCostumes } from '../catalog';
import { friendUnlockCount, soloRackSize, soloShowRack, soloShowRackIds } from '../rack';

describe('runway rack', () => {
  it('seeds a stable solo rack of round(catalog/3) pieces', () => {
    const catalog = allCostumes();
    expect(catalog.length).toBe(23);
    expect(soloRackSize()).toBe(8);
    const a = soloShowRackIds('show-stable');
    const b = soloShowRackIds('show-stable');
    expect(a).toEqual(b);
    expect(a.length).toBe(8);
    expect(new Set(a).size).toBe(8);
    const other = soloShowRackIds('show-other');
    expect(other).not.toEqual(a);
  });

  it('unlocks friend drip in 8 / 8 / 7 tranches', () => {
    const sent = 1_000_000;
    expect(friendUnlockCount(sent, sent + 4 * 60_000)).toBe(0);
    expect(friendUnlockCount(sent, sent + 5 * 60_000)).toBe(8);
    expect(friendUnlockCount(sent, sent + 6 * 60_000 + 59_000)).toBe(8);
    expect(friendUnlockCount(sent, sent + 7 * 60_000)).toBe(16);
    expect(friendUnlockCount(sent, sent + 9 * 60_000)).toBe(23);
    expect(soloShowRack('x').every((piece) => catalogHas(piece.id))).toBe(true);
  });
});

function catalogHas(id: string): boolean {
  return allCostumes().some((piece) => piece.id === id);
}
