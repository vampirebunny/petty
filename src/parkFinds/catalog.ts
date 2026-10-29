import bundled from './park-finds-catalog.json';
import { hasParkFindArt } from './artMap';
import type { ParkFindCatalogRow, ParkFindSpecies } from './types';
import { getDb } from '../db/database';
import { getSupabase } from '../compliance/supabase';

const CACHE_KEY = 'park_finds_catalog_json';
const VERSION_KEY = 'park_finds_catalog_version';

function asRow(raw: unknown): ParkFindCatalogRow | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const species = row.species;
  const rarity = row.rarity;
  const conditionType = row.condition_type;
  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    (species !== 'dog' && species !== 'cat' && species !== 'both') ||
    (rarity !== 'common' && rarity !== 'uncommon' && rarity !== 'rare' && rarity !== 'legendary') ||
    (conditionType !== 'always' &&
      conditionType !== 'season' &&
      conditionType !== 'weather' &&
      conditionType !== 'time' &&
      conditionType !== 'moon' &&
      conditionType !== 'date_window') ||
    typeof row.sort_order !== 'number' ||
    typeof row.art_key !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    species,
    rarity,
    condition_type: conditionType,
    condition_value: typeof row.condition_value === 'string' ? row.condition_value : null,
    sort_order: row.sort_order,
    art_key: row.art_key,
    active: row.active !== false,
  };
}

function parseRows(json: string | unknown): ParkFindCatalogRow[] {
  const data = typeof json === 'string' ? (JSON.parse(json) as unknown) : json;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((entry) => {
    const row = asRow(entry);
    return row ? [row] : [];
  });
}

function readCached(): ParkFindCatalogRow[] | null {
  try {
    const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', CACHE_KEY);
    if (!row?.value) {
      return null;
    }
    return parseRows(row.value);
  } catch {
    return null;
  }
}

function writeCached(rows: ParkFindCatalogRow[], version: number): void {
  getDb().runSync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    CACHE_KEY,
    JSON.stringify(rows),
  );
  getDb().runSync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    VERSION_KEY,
    String(version),
  );
}

function withArt(rows: ParkFindCatalogRow[]): ParkFindCatalogRow[] {
  return rows.filter((row) => row.active && hasParkFindArt(row.art_key));
}

let memo: ParkFindCatalogRow[] | null = null;

export function loadParkFindsCatalog(): ParkFindCatalogRow[] {
  if (memo) {
    return memo;
  }
  const cached = readCached();
  const baseline = withArt(parseRows(bundled));
  if (!cached || cached.length === 0) {
    memo = baseline;
    return memo;
  }
  // Prefer remote/cached rows by id; keep art-gated filtering.
  const byId = new Map(baseline.map((row) => [row.id, row]));
  for (const row of withArt(cached)) {
    byId.set(row.id, row);
  }
  memo = [...byId.values()].sort((a, b) => a.sort_order - b.sort_order);
  return memo;
}

export function invalidateParkFindsCatalogCache(): void {
  memo = null;
}

export function parkFindById(id: string): ParkFindCatalogRow | null {
  return loadParkFindsCatalog().find((row) => row.id === id) ?? null;
}

export function catalogForSpecies(species: 'dog' | 'cat'): ParkFindCatalogRow[] {
  return loadParkFindsCatalog().filter(
    (row) => row.species === species || row.species === ('both' as ParkFindSpecies),
  );
}

/** Downloads remote catalog when available. Bundled baseline always works offline. */
export async function refreshParkFindsCatalog(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  const { data: config, error: configError } = await supabase
    .from('park_finds_config')
    .select('version')
    .eq('id', 1)
    .maybeSingle();
  if (configError || !config) {
    return false;
  }
  const version = Number(config.version);
  const local = getDb().getFirstSync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    VERSION_KEY,
  );
  if (local && Number(local.value) === version) {
    return true;
  }
  const { data, error } = await supabase
    .from('park_finds')
    .select(
      'id, name, species, rarity, condition_type, condition_value, sort_order, art_key, active',
    );
  if (error || !data) {
    return false;
  }
  const rows = withArt(parseRows(data));
  if (rows.length === 0) {
    return false;
  }
  writeCached(rows, version);
  invalidateParkFindsCatalogCache();
  return true;
}
