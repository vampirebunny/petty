import { buildFriendLink, parseFriendLink } from '../friendLink';
import { isOwnHandle } from '../rules';

it('builds and parses an add link', () => {
  expect(parseFriendLink(buildFriendLink('Rosie'))).toBe('Rosie');
  expect(parseFriendLink('https://boopboop.mylisto.app/add/rosie')).toBe('rosie');
});

it('rejects links that are not a Boop Boop add code', () => {
  expect(parseFriendLink('https://example.com/add/rosie')).toBeNull();
  expect(parseFriendLink('https://boopboop.mylisto.app/get')).toBeNull();
  expect(parseFriendLink('https://boopboop.mylisto.app/add')).toBeNull();
  expect(parseFriendLink('https://boopboop.mylisto.app/add/ab')).toBeNull();
  expect(parseFriendLink('https://boopboop.mylisto.app/add/has_underscore')).toBeNull();
  expect(parseFriendLink('https://boopboop.mylisto.app/add/rosie/extra')).toBeNull();
  expect(parseFriendLink('not a url')).toBeNull();
});

it('treats the signed-in handle as your own', () => {
  expect(isOwnHandle('Rosie', 'rosie')).toBe(true);
  expect(isOwnHandle('@Maple', 'maple')).toBe(true);
  expect(isOwnHandle('maple', 'rosie')).toBe(false);
  expect(isOwnHandle('rosie', null)).toBe(false);
});
