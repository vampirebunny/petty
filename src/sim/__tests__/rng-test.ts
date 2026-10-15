import { nextRng } from '../rng';

function sequence(seed: number, steps: number): number[] {
  const values: number[] = [];
  let state = seed;
  for (let i = 0; i < steps; i += 1) {
    const step = nextRng(state);
    values.push(step.value);
    state = step.state;
  }
  return values;
}

it('repeats the same sequence for the same seed', () => {
  const values = sequence(1, 5);

  expect(sequence(1, 5)).toEqual(values);
  expect(new Set(values).size).toBe(values.length);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});

it('can produce a different sequence from a different seed', () => {
  expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
});
