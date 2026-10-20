import { pointAddGapMs, queuePointAdds } from '../pointAdds';

it('starts an idle queue immediately and spaces later adds', () => {
  const meal = queuePointAdds(1000, 0, 2);
  expect(meal.times).toEqual([1000, 1000 + pointAddGapMs]);
  expect(meal.cursor).toBe(1000 + pointAddGapMs * 2);

  const follow = queuePointAdds(1000 + 40, meal.cursor, 1);
  expect(follow.times).toEqual([1000 + pointAddGapMs * 2]);
});

it('starts immediately once the previous queue has finished', () => {
  const next = queuePointAdds(5000, 1000, 1);
  expect(next.times).toEqual([5000]);
  expect(next.cursor).toBe(5000 + pointAddGapMs);
});

it('leaves an empty batch on the same cursor', () => {
  expect(queuePointAdds(1000, 1400, 0)).toEqual({ times: [], cursor: 1400 });
});
