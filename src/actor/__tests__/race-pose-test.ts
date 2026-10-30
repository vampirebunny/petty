import { daysToSenior } from '../../sim/config';
import { leapLift, raceAirPx, raceCadence, raceGaitFor, raceHurdleSize, stepRaceMotion, stepRaceRun } from '../raceDrive';
import type { RaceLeap } from '../raceDrive';
import { raceLeapVisual, stumbleVisualAt } from '../jump';
import { racePoses } from '../data/locomotion';
import { geomOf } from '../geometry';
import { breedById } from '../breeds';
import { spawnActor } from '../sim';

function pet(breedId: string, ageDays: number) {
  return spawnActor({
    id: 'pet',
    breedId,
    ageDays,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
  });
}

describe('race poses', () => {
  it('leaps high enough to clear the fitted hurdle even from the edge of the zone', () => {
    for (const breedId of ['retriever', 'pug', 'siamese']) {
      const actor = pet(breedId, 16);
      const breed = breedById(breedId)!;
      const airPx = raceAirPx(actor, breed, 4.5, racePoses.hurdlesLegsPerMeter);
      const { barZ, apex } = raceHurdleSize(actor, airPx);
      expect(barZ).toBeGreaterThan(0);
      // Edge jumps pass over the hurdle a quarter of the air from take-off or touchdown.
      expect(leapLift(0.25) * apex).toBeGreaterThan(barZ);
      expect(leapLift(0.5) * apex).toBeCloseTo(apex, 5);
      // A long leap is a high arc too, not a skim.
      expect(apex).toBeGreaterThanOrEqual(airPx * 0.3);
    }
  });

  it('picks the gait from race speed and ignores home top speed', () => {
    expect(raceGaitFor(1)).toBe('walk');
    expect(raceGaitFor(2)).toBe('trot');
    expect(raceGaitFor(4)).toBe('canter');
    expect(raceGaitFor(5)).toBe('gallop');
    const actor = pet('retriever', 16);
    const breed = breedById('retriever')!;
    stepRaceRun(actor, breed, racePoses.topMps, 0.05);
    expect(actor.share).toBeCloseTo(1, 5);
    expect(actor.gait.current).toBe('gallop');
    expect(actor.face).toBe(1);
    expect(actor.pose.lie).toBe(0);
  });

  it('cycles the legs faster when the race speed is higher', () => {
    const breed = breedById('retriever')!;
    const slow = pet('retriever', 16);
    const fast = pet('retriever', 16);
    expect(raceCadence(11)).toBeGreaterThan(raceCadence(4));
    for (let i = 0; i < 20; i += 1) {
      stepRaceRun(slow, breed, 4, 0.05);
      stepRaceRun(fast, breed, 11, 0.05);
    }
    expect(fast.phase).toBeGreaterThan(slow.phase * 1.5);
    expect(fast.raceCadence).toBeGreaterThan(slow.raceCadence ?? 0);
  });

  it('leaps with the front legs forward and the hind legs back', () => {
    const adult = pet('retriever', 16);
    const peak = raceLeapVisual(adult, 0.5, 0);
    expect(peak?.fore.x).toBeCloseTo(0.91, 2);
    expect(peak?.hind.x).toBeCloseTo(-0.91, 2);
    expect(peak?.eyes).toBeGreaterThan(0.9);
    const senior = pet('retriever', daysToSenior);
    const short = raceLeapVisual(senior, 0.5, 0);
    expect(short?.fore.x).toBeCloseTo(0.91 * racePoses.seniorLeap, 2);
    expect(short?.hind.x).toBeCloseTo(-0.91 * racePoses.seniorLeap, 2);
  });

  it('buckles and recovers without lying down', () => {
    const actor = pet('corgi', 16);
    const breed = breedById('corgi')!;
    const L = geomOf(breed, actor.displayAgeDays, 0, 1).L;
    const start = stumbleVisualAt(0, L);
    const buckle = stumbleVisualAt(0.15, L);
    const done = stumbleVisualAt(1, L);
    expect(start.blend).toBe(0);
    expect(buckle.pitch).toBeCloseTo(0.28, 5);
    expect(buckle.fore.x).toBeCloseTo(-0.71, 2);
    expect(buckle.squint).toBe(1);
    expect(buckle.fore.plant).toBe(false);
    expect(done.blend).toBe(0);
    stepRaceRun(actor, breed, 5, 0.05);
    expect(actor.pose.lie).toBe(0);
  });

  it('finishes a leap that is still in the air, then gallops', () => {
    const actor = pet('retriever', 16);
    const breed = breedById('retriever')!;
    let leap: RaceLeap | null = {
      airU: 0.4,
      afterLandS: 0,
      airSeconds: racePoses.leapAirSeconds,
      apex: racePoses.leapApexPx,
      landed: false,
    };
    leap = stepRaceMotion(actor, breed, 8, 0.05, leap, true);
    expect(leap).not.toBeNull();
    expect(leap!.airU).toBeGreaterThan(0.4);
    expect(leap!.airU).toBeLessThan(1);
    expect(actor.jump).toBeTruthy();
    expect(actor.z).toBeGreaterThan(0);

    let steps = 0;
    while (leap && steps < 80) {
      leap = stepRaceMotion(actor, breed, 8, 0.05, leap, true);
      steps += 1;
    }
    expect(leap).toBeNull();
    expect(actor.jump).toBeFalsy();
    expect(actor.z).toBe(0);
    expect(actor.gait.current).toBe('gallop');
    expect(actor.pose.lie).toBe(0);
  });
});
