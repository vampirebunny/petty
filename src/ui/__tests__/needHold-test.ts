import { needHold, presentNeeds, sumHolds } from '../needHold';

const before = { hunger: 40, energy: 30, happiness: 50 };

it('keeps tummy, energy, and mood where they were until the treat hold is released', () => {
  const after = { hunger: 30, energy: 100, happiness: 60 };
  const hold = needHold(before, after);
  expect(presentNeeds(after, hold)).toEqual(before);
  expect(presentNeeds(after, null)).toEqual(after);
});

it('stacks holds and still shows later changes underneath', () => {
  const first = needHold(before, { hunger: 30, energy: 30, happiness: 60 });
  const second = needHold({ hunger: 30, energy: 30, happiness: 60 }, { hunger: 20, energy: 30, happiness: 70 });
  const held = sumHolds([first, second]);
  const decayed = { hunger: 22, energy: 30, happiness: 68 };
  expect(presentNeeds(decayed, held)).toEqual({ hunger: 42, energy: 30, happiness: 48 });
  expect(presentNeeds(decayed, sumHolds([second]))).toEqual({ hunger: 32, energy: 30, happiness: 58 });
});
