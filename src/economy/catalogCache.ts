import { getDb } from '../db/database';
import { localDay } from './clock';

export type CatalogCacheRow = {
  active_json: string | null;
  active_version: number | null;
  pending_json: string | null;
  pending_version: number | null;
  pending_on: string | null;
};

export function readCatalogCache(): CatalogCacheRow | null {
  return getDb().getFirstSync<CatalogCacheRow>('SELECT * FROM shop_catalog_cache WHERE id = 1');
}

export function promoteCatalog(row: CatalogCacheRow): void {
  getDb().runSync(
    `INSERT INTO shop_catalog_cache (id, active_json, active_version, pending_json, pending_version, pending_on)
     VALUES (1, ?, ?, NULL, NULL, NULL)
     ON CONFLICT(id) DO UPDATE SET
       active_json = excluded.active_json,
       active_version = excluded.active_version,
       pending_json = NULL,
       pending_version = NULL,
       pending_on = NULL`,
    row.pending_json,
    row.pending_version,
  );
}

// Same version loadShopCatalog would report, including a pending download that became active today.
export function activeCatalogVersion(now = Date.now()): number | null {
  const today = localDay(now);
  const row = readCatalogCache();
  if (row?.pending_json && row.pending_on && row.pending_on <= today) {
    promoteCatalog(row);
    return versionOf(row.pending_json);
  }
  return versionOf(row?.active_json ?? null);
}

function versionOf(json: string | null): number | null {
  if (!json) {
    return null;
  }
  try {
    const remote = JSON.parse(json) as { version?: unknown; items?: unknown };
    if (!remote || !Array.isArray(remote.items) || typeof remote.version !== 'number') {
      return null;
    }
    return remote.version;
  } catch {
    return null;
  }
}
