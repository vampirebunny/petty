// npx tsx tools/colorways/seed.ts
// Writes insert-only SQL for the ids listed in picks.json. An empty list writes no rows.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Tier = 'common' | 'uncommon' | 'rare' | 'limited' | 'exclusive';

type Generated = {
  id: string;
  slot: string;
  label: string;
  shape: string;
  colorway: Record<string, unknown>;
  patternParts?: string[];
  theme: string;
  collection?: string;
  season?: string;
  tier: Tier;
};

const root = join(__dirname);
const picks = JSON.parse(readFileSync(join(root, 'picks.json'), 'utf8')) as string[];
const items = JSON.parse(readFileSync(join(root, 'generated', 'colorways.json'), 'utf8')) as Generated[];

// Shape prices. Rare colorways stay at the shape price.
// Exclusive is 1.25× and limited is 1.5×, rounded half-up to the nearest 50.
const priceOf: Record<string, number> = {
  beanie: 1000,
  party: 1300,
  top: 1800,
  cap: 1100,
  bucket: 1200,
  beret: 1400,
  square: 900,
  'red-rim': 900,
  heart: 900,
  star: 900,
  collar: 600,
  bandana: 500,
  scarf: 700,
  bow: 500,
  bowtie: 800,
  sweater: 2800,
  hoodie: 3200,
  puffer: 3200,
  vest: 2800,
  raincoat: 3600,
  red: 2000,
  rain: 2000,
  sneaker: 2000,
  hightop: 2000,
};

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullable(value: string | undefined): string {
  return value ? sqlText(value) : 'null';
}

function price(item: Generated): number {
  const amount = priceOf[item.shape];
  if (amount == null) {
    throw new Error(`no price for shape ${item.shape}`);
  }
  const multiplier = item.tier === 'exclusive' ? 1.25 : item.tier === 'limited' ? 1.5 : 1;
  return Math.round((amount * multiplier) / 50) * 50;
}

function shelf(tier: Tier): { shop: string; tier: string; cap: string } {
  if (tier === 'limited') {
    return { shop: 'featured', tier: 'limited', cap: '500' };
  }
  if (tier === 'exclusive') {
    return { shop: 'rotation', tier: 'exclusive', cap: 'null' };
  }
  return { shop: 'always', tier: 'standard', cap: 'null' };
}

function wanted(pick: string, item: Generated): boolean {
  return pick === item.id || pick === `${item.slot}:${item.id}`;
}

const chosen: Generated[] = [];
const missing: string[] = [];
for (const pick of picks) {
  const item = items.find((entry) => wanted(pick, entry));
  if (!item) {
    missing.push(pick);
    continue;
  }
  if (!chosen.some((entry) => entry.id === item.id)) {
    chosen.push(item);
  }
}

const outDir = join(root, 'generated');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'seed.sql');

if (chosen.length === 0) {
  writeFileSync(out, '-- no picks\n');
  if (missing.length) {
    console.error(`unknown picks: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('0 rows');
  process.exit(0);
}

const rows = chosen.map((item, index) => {
  const place = shelf(item.tier);
  const def: Record<string, unknown> = {
    v: 2,
    kind: 'outfit',
    slot: item.slot,
    shape: item.shape,
    label: item.label,
    colorway: item.colorway,
  };
  if (item.patternParts) {
    def.patternParts = item.patternParts;
  }
  return `  (${sqlText(`${item.slot}:${item.id}`)}, ${sqlText(item.label)}, 'clothes', ${price(item)}, '${place.shop}', null, null, ${index}, true, '${place.tier}', ${place.cap}, ${sqlText(JSON.stringify(def))}::jsonb, ${sqlNullable(item.theme)}, ${sqlNullable(item.collection)}, ${sqlNullable(item.season)}, ${sqlText(item.tier)})`;
});

const sql = `-- Insert-only colorway seed. Existing ids are left untouched.
insert into public.shop_items (id, name, category, price, shop, species, description, sort, active, tier, cap, def, theme, collection, season, rarity)
values
${rows.join(',\n')}
on conflict (id) do nothing;
`;

writeFileSync(out, sql);
if (missing.length) {
  console.error(`unknown picks: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`${chosen.length} rows -> generated/seed.sql`);
