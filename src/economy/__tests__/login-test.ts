import { loginOffer } from '../login';

it('starts the ladder on the first claim and loops after day 7', () => {
  expect(loginOffer(null, 0, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 20 });
  expect(loginOffer('2026-10-21', 7, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 20 });
});

it('continues after one missed day and resets after two', () => {
  expect(loginOffer('2026-10-21', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 4, reward: 35 });
  expect(loginOffer('2026-10-20', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 4, reward: 35 });
  expect(loginOffer('2026-10-19', 3, '2026-10-22')).toEqual({ claimable: true, streakDay: 1, reward: 20 });
});

it('does not offer a second claim on the same day', () => {
  expect(loginOffer('2026-10-22', 4, '2026-10-22').claimable).toBe(false);
});
