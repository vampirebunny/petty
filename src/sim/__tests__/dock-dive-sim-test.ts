import {
  compareDives,
  diveBonus,
  diveClass,
  diveScore,
  dockDiveConfig,
  edgeMs,
  meterAt,
  npcDives,
  runDive,
  spotAt,
} from '../../../supabase/functions/_shared/race-sim/index.ts';

const version = 'dockdive-1';
const mods = { energy: 85, mood: 50, stamina: 0, agility: 50, intelligence: 50 };

// Hold so the meter peaks `leadMs` before the edge, and release then.
function peakAt(leadMs: number, classId: 'beginner' | 'championship' = 'beginner') {
  const period = diveClass(classId, version).periodMs;
  const release = edgeMs(classId, version) - leadMs;
  return [
    { at: release - period / 2, down: true },
    { at: release, down: false },
  ];
}

describe('dock dive sim', () => {
  it('reaches the edge at about 2.5 s whatever the stamina', () => {
    const edge = edgeMs('beginner', version);
    expect(edge).toBeGreaterThan(2400);
    expect(edge).toBeLessThan(2550);
    const strong = { ...mods, stamina: 100 };
    const late = [{ at: edge - 600, down: true }];
    expect(runDive(late, strong, 'beginner', version).takeoffMs).toBe(runDive(late, mods, 'beginner', version).takeoffMs);
  });

  it('jumps farthest from the top of the meter just before the edge', () => {
    const best = runDive(peakAt(20), mods, 'beginner', version);
    const early = runDive(peakAt(500), mods, 'beginner', version);
    const offPeak = runDive(
      [
        { at: edgeMs('beginner', version) - 600, down: true },
        { at: edgeMs('beginner', version) - 20, down: false },
      ],
      mods,
      'beginner',
      version,
    );
    expect(best.flop).toBe(false);
    expect(best.distanceM).toBeGreaterThan(7.5);
    expect(best.distanceM).toBeGreaterThan(early.distanceM);
    expect(best.distanceM).toBeGreaterThan(offPeak.distanceM);
  });

  it('belly flops when the pet reaches the edge still holding, or without holding', () => {
    const holding = runDive([{ at: 500, down: true }], mods, 'championship', version);
    expect(holding.flop).toBe(true);
    expect(holding.distanceM).toBe(dockDiveConfig.flopM);
    expect(runDive([], mods, 'beginner', version).flop).toBe(true);
  });

  it('ignores a release in the first 0.2 s and keeps running', () => {
    const tap = runDive(
      [
        { at: 300, down: true },
        { at: 400, down: false },
      ],
      mods,
      'beginner',
      version,
    );
    expect(tap.flop).toBe(true);
  });

  it('drops the take-off spot steadily from the edge to a 0.4 floor', () => {
    const zone = diveClass('beginner', version).zoneM;
    expect(spotAt(12, 'beginner', version)).toBe(1);
    expect(spotAt(12 - zone, 'beginner', version)).toBeCloseTo(0.6, 5);
    expect(spotAt(12 - zone * 1.25, 'beginner', version)).toBeCloseTo(0.5, 5);
    expect(spotAt(0, 'beginner', version)).toBe(0.4);
  });

  it('eases the meter from 0 to the top half a period in', () => {
    const period = diveClass('open', version).periodMs;
    expect(meterAt(0, 'open', version)).toBeCloseTo(0, 5);
    expect(meterAt(period / 2, 'open', version)).toBeCloseTo(1, 5);
    expect(meterAt(period, 'open', version)).toBeCloseTo(0, 5);
  });

  it('caps stamina and mood at +10%', () => {
    expect(diveBonus({ ...mods, stamina: 100, mood: 100 }, version)).toBeCloseTo(1.1, 5);
    expect(diveBonus({ ...mods, stamina: 500, mood: 500 }, version)).toBeCloseTo(1.1, 5);
  });

  it('repeats NPC jumps from the seed', () => {
    const npc = { classId: 'open' as const, skill: 0.6, seed: 'race:npc-1' };
    const a = npcDives(npc, version);
    expect(a).toEqual(npcDives(npc, version));
    expect(a).toHaveLength(3);
    for (const dive of a) expect(dive.distanceM).toBeGreaterThanOrEqual(1);
  });

  it('ranks by best, then second-best, then who got there first', () => {
    const jump = (distanceM: number, takeoffMs = 2400) => ({ distanceM, flop: false, takeoffMs, power: 1, spot: 1 });
    const a = diveScore([jump(6), jump(5), jump(1)], version);
    const b = diveScore([jump(6), jump(4), jump(7)], version);
    const c = diveScore([jump(6), jump(5), jump(2)], version);
    const d = diveScore([jump(5), jump(6, 2300), jump(5)], version);
    expect(compareDives(b, a)).toBeLessThan(0);
    expect(compareDives(a, c)).toBe(0);
    expect(b.bestAttempt).toBe(2);
    expect(compareDives(a, d)).toBeLessThan(0);
  });
});
