import { analyticsModuleLoaded, bucketHoursAway, track } from '../analytics';

it('does not load Firebase while collection is off', () => {
  track('tutorial_begin');
  expect(analyticsModuleLoaded()).toBe(false);
});

it('buckets hours away', () => {
  expect(bucketHoursAway(0.2)).toBe('5m-1h');
  expect(bucketHoursAway(3)).toBe('1-5');
  expect(bucketHoursAway(8)).toBe('5-12');
  expect(bucketHoursAway(20)).toBe('12-24');
  expect(bucketHoursAway(48)).toBe('24-72');
  expect(bucketHoursAway(80)).toBe('72+');
});
