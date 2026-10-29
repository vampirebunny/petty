import { updateRequired } from '../required';

it('stays open when the minimum is missing or unreadable', () => {
  expect(updateRequired(null, '1.0.0')).toBe(false);
  expect(updateRequired(undefined, '1.0.0')).toBe(false);
  expect(updateRequired('', '1.0.0')).toBe(false);
  expect(updateRequired('  ', '1.0.0')).toBe(false);
  expect(updateRequired('1.2', '1.0.0')).toBe(false);
});

it('blocks a binary older than the minimum', () => {
  expect(updateRequired('1.2.0', '1.0.0')).toBe(true);
  expect(updateRequired('1.2.1', '1.2.0')).toBe(true);
});

it('stays open when the binary matches or is newer', () => {
  expect(updateRequired('1.2.0', '1.2.0')).toBe(false);
  expect(updateRequired('1.2.0', '1.3.0')).toBe(false);
  expect(updateRequired('1.2.0', '2.0.0')).toBe(false);
});
