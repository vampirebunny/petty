import {
  canPlay,
  canPurchase,
  confirmNo,
  confirmYes,
  mergeAgeRecords,
  statusFromBounds,
  type AgeRecord,
} from '../ageStatus';

function record(status: AgeRecord['status'], source: AgeRecord['source']): AgeRecord {
  return { status, source, updatedAt: 1 };
}

it('keeps the more restrictive age record', () => {
  const adult = record('adult', 'apple');
  const teen = record('teen', 'apple');
  const attested = record('atLeast13', 'attestation');
  const under = record('under13', 'google');

  expect(mergeAgeRecords(adult, teen)).toBe(teen);
  expect(mergeAgeRecords(teen, adult)).toBe(teen);
  expect(mergeAgeRecords(adult, attested)).toBe(attested);
  expect(mergeAgeRecords(attested, under)).toBe(under);
  expect(mergeAgeRecords(under, adult)).toBe(under);
  expect(mergeAgeRecords(adult, null)).toBe(adult);
  expect(mergeAgeRecords(adult, record('unknown', 'apple'))).toBe(adult);
  expect(mergeAgeRecords(null, record('unknown', 'apple'))).toBeNull();
});

it('lets a person play only after a 13+ status', () => {
  expect(canPlay(null)).toBe(false);
  expect(canPlay(record('unknown', 'attestation'))).toBe(false);
  expect(canPlay(record('under13', 'attestation'))).toBe(false);
  expect(canPlay(record('atLeast13', 'attestation'))).toBe(true);
  expect(canPlay(record('teen', 'google'))).toBe(true);
  expect(canPlay(record('adult', 'apple'))).toBe(true);
});

it('allows purchase only for an adult store signal', () => {
  expect(canPurchase(record('adult', 'apple'))).toBe(true);
  expect(canPurchase(record('adult', 'google'))).toBe(true);
  expect(canPurchase(record('adult', 'attestation'))).toBe(false);
  expect(canPurchase(record('teen', 'apple'))).toBe(false);
  expect(canPurchase(record('atLeast13', 'attestation'))).toBe(false);
});

it('keeps a store band when the person confirms yes', () => {
  expect(confirmYes(record('adult', 'apple'), 5)).toEqual({ status: 'adult', source: 'apple', updatedAt: 5 });
  expect(confirmYes(record('teen', 'google'), 5)).toEqual({ status: 'teen', source: 'google', updatedAt: 5 });
  expect(confirmYes(record('under13', 'apple'), 5)).toEqual({ status: 'under13', source: 'apple', updatedAt: 5 });
  expect(confirmYes(null, 5)).toEqual({ status: 'atLeast13', source: 'attestation', updatedAt: 5 });
  expect(confirmYes(record('unknown', 'apple'), 5)).toEqual({
    status: 'atLeast13',
    source: 'attestation',
    updatedAt: 5,
  });
});

it('records a no as under 13', () => {
  expect(confirmNo(9)).toEqual({ status: 'under13', source: 'attestation', updatedAt: 9 });
});

it('maps store bounds onto the four age bands', () => {
  expect(statusFromBounds(null, 12)).toBe('under13');
  expect(statusFromBounds(null, null)).toBeNull();
  expect(statusFromBounds(null, 17)).toBe('under13');
  expect(statusFromBounds(13, 17)).toBe('teen');
  expect(statusFromBounds(16, 17)).toBe('teen');
  expect(statusFromBounds(18, null)).toBe('adult');
  expect(statusFromBounds(13, null)).toBe('adult');
  expect(statusFromBounds(0, 12)).toBe('under13');
});
