import { loginOffer } from '../login';

it('pays 50 on the first open and starts over after day 7', () => {
  expect(loginOffer(null, 0, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 50 });
  expect(loginOffer('2026-10-21', 7, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 50 });
});

it('pays the streak bonus only on day 7', () => {
  expect(loginOffer('2026-10-21', 6, '2026-10-22')).toEqual({ claimable: true, streakDay: 7, reward: 200 });
});

it('keeps the streak across one missed day and restarts after two', () => {
  expect(loginOffer('2026-10-21', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 4, reward: 50 });
  expect(loginOffer('2026-10-20', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 4, reward: 50 });
  expect(loginOffer('2026-10-20', 6, '2026-10-22')).toEqual({ claimable: true, streakDay: 7, reward: 200 });
  expect(loginOffer('2026-10-19', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 50 });
});

it('does not offer a second claim on the same day', () => {
  expect(loginOffer('2026-10-22', 4, '2026-10-22').claimable).toBe(false);
});
