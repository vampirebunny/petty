import { daysToSenior } from '../../sim/config';
import { raceGaitFor, stepRaceRun } from '../raceDrive';
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
});
