import { planTimePayout } from '../../economy/accrual';
import { ownerIdTables } from '../../db/ownerTables';
import { schemaSql } from '../../db/database';
import { testPet } from '../../sim/__fixtures__/pets';
import { resume } from '../../sim/clock';
import { deviceLabel } from '../deviceLabel';
import { assertClientsDiffer, createHarnessClient } from '../harness';

it('rejects a harness that shares one device', () => {
  const shared = createHarnessClient({ databasePath: '/tmp/boop.db', ownerId: 'a', installId: 'install' });
  expect(() => assertClientsDiffer(shared, { ...shared })).toThrow(/same device/);
});

it('accepts two injected clients', () => {
  const phone = createHarnessClient({ databasePath: '/tmp/phone.db', ownerId: 'user-phone', installId: 'phone' });
  const tablet = createHarnessClient({ databasePath: '/tmp/tablet.db', ownerId: 'user-tablet', installId: 'tablet' });
  expect(() => assertClientsDiffer(phone, tablet)).not.toThrow();
  expect(phone.installId).not.toBe(tablet.installId);
  expect(phone.ownerId).not.toBe(tablet.ownerId);
  expect(phone.databasePath).not.toBe(tablet.databasePath);
});

it('names the device from the platform', () => {
  expect(deviceLabel('ios', false)).toBe('iPhone');
  expect(deviceLabel('ios', true)).toBe('iPad');
  expect(deviceLabel('android', false)).toBe('Android');
});

it('pays the gap when the clock is behind last trusted time but ahead of the cursor', () => {
  const start = new Date(2026, 9, 22, 9, 0, 0).getTime();
  const planned = planTimePayout(
    start + 60 * 60_000,
    { timePaidThrough: start, timeCappedDay: null, lastTrustedTime: start + 2 * 60 * 60_000 },
    0,
    'return',
  );
  expect(planned.save).toBe(true);
  expect(planned.amount).toBe(60);
});

it('does not rewind lastUpdatedAt when server time is behind', () => {
  const pet = testPet(1, 'retriever', 20_000, 'Boop', 'pet', 'athlete');
  const next = resume(pet, 5_000);
  expect(next.lastUpdatedAt).toBe(20_000);
});

it('lists every owner_id table in rebindOwner', () => {
  const declared = [...ownerIdTables].sort();
  const found = new Set<string>();
  for (const statement of schemaSql.split(';')) {
    const table = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(statement)?.[1];
    if (table && /\bowner_id\b/.test(statement)) {
      found.add(table);
    }
  }
  expect([...found].sort()).toEqual(declared);
});
