// npx tsx tools/colorways/cli.ts            -> writes generated/colorways.json + warnings.txt
// npx tsx tools/colorways/cli.ts --lock     -> also records every current item in the lock file
//
// The lock file is the immutability guard: once an id has been published, its look can never
// change. To change a look, make a new theme id (new item ids) and retire the old items.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './generate';
import { THEMES } from './themes';

const OUT = join(__dirname, 'generated');
const LOCK = join(__dirname, 'colorways.lock.json');

const lockMode = process.argv.includes('--lock');
const { items, warnings } = generate(THEMES);

const look = (i: (typeof items)[number]) =>
  JSON.stringify({ shape: i.shape, colorway: i.colorway, patternParts: i.patternParts ?? null });

const lock: Record<string, string> = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
const changed = items.filter((i) => lock[i.id] && lock[i.id] !== look(i));
if (changed.length) {
  console.error('These published items would change look. Use a new theme id instead:');
  for (const i of changed) console.error(`  ${i.id}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'colorways.json'), JSON.stringify(items, null, 2) + '\n');
writeFileSync(
  join(OUT, 'warnings.txt'),
  warnings.map((w) => `${w.kind.padEnd(7)} ${w.id.padEnd(34)} ${w.message}`).join('\n') + '\n',
);
writeFileSync(join(OUT, 'warnings.json'), JSON.stringify(warnings, null, 2) + '\n');

if (lockMode) {
  for (const i of items) lock[i.id] = look(i);
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
}

const bySlot = items.reduce<Record<string, number>>((acc, i) => ((acc[i.slot] = (acc[i.slot] ?? 0) + 1), acc), {});
const byTier = items.reduce<Record<string, number>>((acc, i) => ((acc[i.tier] = (acc[i.tier] ?? 0) + 1), acc), {});
console.log(`${items.length} items from ${THEMES.length} themes`, bySlot, byTier);
console.log(`${warnings.length} warnings -> generated/warnings.txt`);
const schema = warnings.filter((w) => w.kind === 'schema');
if (schema.length) {
  console.error(`${schema.length} schema errors; fix before seeding`);
  process.exit(1);
}
