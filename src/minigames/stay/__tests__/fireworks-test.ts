import { createShow, stepShow } from '../fireworks';

describe('stay fireworks', () => {
  it('builds the same rockets from the same seed', () => {
    const a = createShow(400, 800, 7);
    const b = createShow(400, 800, 7);
    expect(a.rockets.map((rocket) => [rocket.explodeAt, rocket.x, rocket.vy])).toEqual(
      b.rockets.map((rocket) => [rocket.explodeAt, rocket.x, rocket.vy]),
    );
  });

  it('bursts, then finishes', () => {
    const show = createShow(400, 800, 3);
    expect(show.done).toBe(false);
    let frames = 0;
    while (!show.rockets.some((rocket) => rocket.gone) && frames < 60) {
      stepShow(show, 1 / 30);
      frames += 1;
    }
    const burst = show.rockets.find((rocket) => rocket.gone);
    expect(burst?.sparks.some((spark) => spark.on)).toBe(true);

    while (!show.done && frames < 300) {
      stepShow(show, 1 / 30);
      frames += 1;
    }
    expect(show.done).toBe(true);
    expect(frames).toBeGreaterThan(10);
  });
});
