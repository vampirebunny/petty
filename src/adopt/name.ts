export const nameLimit = 16;

export type NameRejectReason = 'empty' | 'length' | 'chars' | 'link' | 'blocked';

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; reason: NameRejectReason };

/** Letters, numbers, spaces, and a small set of name punctuation. */
const allowedChars = /^[\p{L}\p{N} .'-]+$/u;

/** Invisible / bidi / control characters that should never appear in a display name. */
const unsafeChars = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;

const urlOrHandle =
  /https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|co|app|me|tv|gg|xyz)\b|t\.me\/|@[\w.]/i;

/** Exact-token bans (short words that would false-positive as substrings). */
/** Exact-token bans (short/ambiguous words that false-positive as substrings). */
const bannedTokens = new Set([
  'ass',
  'sex',
  'cum',
  'tit',
  'fag',
  'dick',
  'cock',
  'boob',
  'boobs',
  'porn',
  'xxx',
  'nazi',
  'meth',
  'mod',
  'admin',
  'staff',
  'support',
  'official',
  'boopboop',
  'mylisto',
]);

/**
 * Longer bans matched as substrings of the compact normalized form.
 * Keep this list curated; avoid short stems that appear inside normal names.
 */
const bannedSubstrings = [
  'fuck',
  'fuk',
  'fvck',
  'fck',
  'fock',
  'shit',
  'bitch',
  'cunt',
  'pussy',
  'penis',
  'vagina',
  'nigger',
  'nigga',
  'retard',
  'faggot',
  'whore',
  'slut',
  'rape',
  'rapist',
  'killme',
  'killyou',
  'suicide',
  'cocaine',
  'heroin',
  'hitler',
  'pedo',
  'paedo',
  'onlyfans',
  'boopboopstaff',
  'boopstaff',
];

const leet: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
};

export function nameRejectMessage(reason: NameRejectReason): string {
  switch (reason) {
    case 'empty':
      return 'Enter a name.';
    case 'length':
      return `Use up to ${nameLimit} characters.`;
    case 'chars':
      return "Use letters, numbers, spaces, and ' - . only.";
    case 'link':
      return 'Links and social handles aren’t allowed.';
    case 'blocked':
      return 'Pick a different name.';
  }
}

/** Normalize for blocklist matching: lowercase, strip marks, map leetspeak, drop non-alnum. */
export function normalizeForMatch(value: string): string {
  const folded = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  let out = '';
  for (const ch of folded) {
    out += leet[ch] ?? ch;
  }
  return out.replace(/[^a-z0-9]/g, '');
}

function isBlocked(name: string): boolean {
  const compact = normalizeForMatch(name);
  if (compact.length === 0) {
    return false;
  }
  if (bannedSubstrings.some((word) => compact.includes(word))) {
    return true;
  }
  const tokens = name
    .toLowerCase()
    .split(/[\s.'-]+/)
    .map((token) => normalizeForMatch(token))
    .filter((token) => token.length > 0);
  return tokens.some((token) => bannedTokens.has(token));
}

/**
 * Validates a display or pet name against length, character, link, and content rules.
 * Returns a cleaned NFC name on success.
 */
export function validateName(value: string): NameValidation {
  const cleaned = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (cleaned.length > nameLimit) {
    return { ok: false, reason: 'length' };
  }
  if (unsafeChars.test(cleaned)) {
    return { ok: false, reason: 'chars' };
  }
  // Prefer the link message for @handles and URLs even when characters are also invalid.
  if (urlOrHandle.test(cleaned)) {
    return { ok: false, reason: 'link' };
  }
  if (!allowedChars.test(cleaned)) {
    return { ok: false, reason: 'chars' };
  }
  if (isBlocked(cleaned)) {
    return { ok: false, reason: 'blocked' };
  }
  return { ok: true, name: cleaned };
}

/** Convenience wrapper used by adopt UI: cleaned name or null. */
export function cleanName(value: string): string | null {
  const result = validateName(value);
  return result.ok ? result.name : null;
}
