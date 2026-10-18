import { cleanName } from '../name';

it('requires a trimmed name of at most 16 characters', () => {
  expect(cleanName('   ')).toBeNull();
  expect(cleanName(' Maple ')).toBe('Maple');
  expect(cleanName('a'.repeat(17))).toBeNull();
  expect(cleanName('a'.repeat(16))).toBe('a'.repeat(16));
});
