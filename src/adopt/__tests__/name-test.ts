import { cleanName, normalizeForMatch, validateName } from '../name';

it('requires a trimmed name of at most 16 characters', () => {
  expect(cleanName('   ')).toBeNull();
  expect(cleanName(' Maple ')).toBe('Maple');
  expect(cleanName('a'.repeat(17))).toBeNull();
  expect(cleanName('a'.repeat(16))).toBe('a'.repeat(16));
});

it('collapses inner whitespace and NFC-normalizes', () => {
  expect(cleanName('  Soft   Paw  ')).toBe('Soft Paw');
  expect(validateName('Cafe\u0301')).toEqual({ ok: true, name: 'Café' });
});

it('rejects disallowed characters and invisible control marks', () => {
  expect(validateName('Spot!')).toEqual({ ok: false, reason: 'chars' });
  expect(validateName('Hi<script>')).toEqual({ ok: false, reason: 'chars' });
  expect(validateName('Boop\u200BDog')).toEqual({ ok: false, reason: 'chars' });
  expect(validateName('A\u202Ename')).toEqual({ ok: false, reason: 'chars' });
  expect(cleanName("O'Malley")).toBe("O'Malley");
  expect(cleanName('Mary-Jane')).toBe('Mary-Jane');
  expect(cleanName('Dr. Pepper')).toBe('Dr. Pepper');
});

it('rejects links and social handles', () => {
  expect(validateName('www.evil.com')).toEqual({ ok: false, reason: 'link' });
  expect(validateName('http://x.io')).toEqual({ ok: false, reason: 'link' });
  expect(validateName('t.me/spam')).toEqual({ ok: false, reason: 'link' });
  expect(validateName('@handle')).toEqual({ ok: false, reason: 'link' });
});

it('rejects reserved and blocked names without quoting them', () => {
  expect(validateName('admin')).toEqual({ ok: false, reason: 'blocked' });
  expect(validateName('BoopBoop')).toEqual({ ok: false, reason: 'blocked' });
  expect(validateName('f u c k')).toEqual({ ok: false, reason: 'blocked' });
  expect(validateName('sh1t')).toEqual({ ok: false, reason: 'blocked' });
  expect(validateName('Maple')).toEqual({ ok: true, name: 'Maple' });
});

it('maps leetspeak when matching the blocklist', () => {
  expect(normalizeForMatch('f0ck')).toBe('fock');
  expect(normalizeForMatch('Sh1t')).toBe('shit');
  expect(validateName('f0ck')).toEqual({ ok: false, reason: 'blocked' });
});
