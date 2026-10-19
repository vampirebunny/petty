import { flickSpeedThreshold, flickToThrow } from '../flick';

it('maps flick velocity into a throw and keeps a speed threshold', () => {
  const soft = flickToThrow(100, 0);
  const hard = flickToThrow(1200, 0);
  expect(hard.vx).toBeGreaterThan(soft.vx);
  expect(hard.vz).toBeGreaterThan(soft.vz);
  expect(flickSpeedThreshold).toBeGreaterThan(0);
});
