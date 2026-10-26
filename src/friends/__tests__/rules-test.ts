import { canUseFriends, inviteShareMessage, inviteUrl, relationAction } from '../rules';

it('lets only a linked account search or invite', () => {
  expect(canUseFriends(false)).toBe(false);
  expect(canUseFriends(true)).toBe(true);
});

it('hides cancel during the decline cooldown', () => {
  const cooldown = relationAction('cooldown');
  expect(cooldown.disabled).toBe(true);
  expect(cooldown.cancel).toBe(false);
  expect(cooldown.label).toBe("You can't send another request yet.");
  const sent = relationAction('request_sent');
  expect(sent.cancel).toBe(true);
  expect(relationAction('none').action).toBe('send');
});

it('builds the invite share with the site link and an optional handle', () => {
  expect(inviteShareMessage(null)).toBe(
    `I've been playing Boop Boop, a virtual pet game. Adopt a pet so ours can have playdates! ${inviteUrl}`,
  );
  expect(inviteShareMessage('Maple')).toContain(`${inviteUrl}\nMy handle is @Maple`);
  expect(inviteUrl).toBe('https://boopboop.mylisto.app');
});
