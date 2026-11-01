import { getSessionUserId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import { currentOwner, ownerIsReady } from '../db/currentOwner';
import { getDb, transaction } from '../db/database';

export type CachedAward = {
  id: string;
  petId: string | null;
  definitionId: string;
  source: 'race' | 'runway';
  raceId: string | null;
  showId: string | null;
  placing: number | null;
  earnedAt: string;
  configVersion: number;
  snapshot: Record<string, unknown>;
};

export type CachedProgress = {
  petId: string | null;
  key: string;
  value: number;
};

export type CachedDefinition = {
  id: string;
  family: string;
  kind: string;
  track: string;
  eventType: string | null;
  class: string | null;
  themeId: string | null;
  tier: string | null;
  threshold: number | null;
  size: number;
  artKey: string | null;
};

export type WornPiece = {
  themeId: string;
  pieceId: string;
};

export type ThemeRackPiece = {
  themeId: string;
  pieceId: string;
};

export type AwardsCache = {
  awards: CachedAward[];
  progress: CachedProgress[];
  definitions: CachedDefinition[];
  worn: WornPiece[];
  themeRack: ThemeRackPiece[];
};

export function emptyAwardsCache(): AwardsCache {
  return { awards: [], progress: [], definitions: [], worn: [], themeRack: [] };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function mapAwardRow(row: Record<string, unknown>): CachedAward | null {
  const id = text(row.id);
  const definitionId = text(row.award_definition_id ?? row.definitionId);
  const source = row.source === 'race' || row.source === 'runway' ? row.source : null;
  const earnedAt = text(row.earned_at ?? row.earnedAt);
  const configVersion = num(row.config_version ?? row.configVersion);
  if (!id || !definitionId || !source || !earnedAt || configVersion == null) {
    return null;
  }
  const snapshot = asRecord(row.pet_snapshot ?? row.snapshot) ?? {};
  return {
    id,
    petId: text(row.pet_id ?? row.petId),
    definitionId,
    source,
    raceId: text(row.race_id ?? row.raceId),
    showId: text(row.show_id ?? row.showId),
    placing: num(row.place ?? row.placing),
    earnedAt,
    configVersion,
    snapshot,
  };
}

export function mapProgressRow(row: Record<string, unknown>): CachedProgress | null {
  const key = text(row.counter_key ?? row.key);
  const value = num(row.value);
  if (!key || value == null) {
    return null;
  }
  return { petId: text(row.pet_id ?? row.petId), key, value };
}

export function mapDefinitionRow(row: Record<string, unknown>): CachedDefinition | null {
  const id = text(row.id);
  const family = text(row.family);
  const kind = text(row.kind);
  const track = text(row.track);
  const size = num(row.size) ?? 1;
  if (!id || !family || !kind || !track) {
    return null;
  }
  return {
    id,
    family,
    kind,
    track,
    eventType: text(row.event_type ?? row.eventType),
    class: text(row.class),
    themeId: text(row.theme_id ?? row.themeId),
    tier: text(row.tier),
    threshold: num(row.threshold),
    size,
    artKey: text(row.art_key ?? row.artKey),
  };
}

function cacheOwner(fallback?: string | null): string | null {
  if (ownerIsReady()) {
    return currentOwner();
  }
  return fallback ?? null;
}

export function readAwardsCache(petId: string): AwardsCache {
  const owner = cacheOwner();
  if (!owner) {
    return emptyAwardsCache();
  }
  const db = getDb();
  const awards = db
    .getAllSync<{ json: string }>('SELECT json FROM award_cache WHERE owner_id = ? AND (pet_id = ? OR pet_id = ?)', owner, petId, '')
    .map((row) => {
      try {
        return mapAwardRow(JSON.parse(row.json) as Record<string, unknown>);
      } catch {
        return null;
      }
    })
    .filter((row): row is CachedAward => row != null);
  const progress = db
    .getAllSync<{ json: string }>(
      'SELECT json FROM award_progress_cache WHERE owner_id = ? AND (pet_id = ? OR pet_id = ?)',
      owner,
      petId,
      '',
    )
    .map((row) => {
      try {
        return mapProgressRow(JSON.parse(row.json) as Record<string, unknown>);
      } catch {
        return null;
      }
    })
    .filter((row): row is CachedProgress => row != null);
  const definitions = db
    .getAllSync<{ json: string }>('SELECT json FROM award_definitions_cache')
    .map((row) => {
      try {
        return mapDefinitionRow(JSON.parse(row.json) as Record<string, unknown>);
      } catch {
        return null;
      }
    })
    .filter((row): row is CachedDefinition => row != null);
  const worn = db
    .getAllSync<{ theme_id: string; piece_id: string }>(
      'SELECT theme_id, piece_id FROM award_worn_cache WHERE owner_id = ? AND pet_id = ?',
      owner,
      petId,
    )
    .map((row) => ({ themeId: row.theme_id, pieceId: row.piece_id }));
  const themeRack = db
    .getAllSync<{ theme_id: string; piece_id: string }>('SELECT theme_id, piece_id FROM award_theme_rack_cache')
    .map((row) => ({ themeId: row.theme_id, pieceId: row.piece_id }));
  return { awards, progress, definitions, worn, themeRack };
}

function writeCache(owner: string, petId: string, next: AwardsCache): void {
  transaction(() => {
    const db = getDb();
    db.runSync('DELETE FROM award_cache WHERE owner_id = ? AND (pet_id = ? OR pet_id = ?)', owner, petId, '');
    db.runSync('DELETE FROM award_progress_cache WHERE owner_id = ? AND (pet_id = ? OR pet_id = ?)', owner, petId, '');
    db.runSync('DELETE FROM award_definitions_cache');
    db.runSync('DELETE FROM award_worn_cache WHERE owner_id = ? AND pet_id = ?', owner, petId);
    db.runSync('DELETE FROM award_theme_rack_cache');
    for (const award of next.awards) {
      db.runSync(
        'INSERT INTO award_cache (owner_id, pet_id, award_id, definition_id, json) VALUES (?, ?, ?, ?, ?)',
        owner,
        award.petId ?? '',
        award.id,
        award.definitionId,
        JSON.stringify(award),
      );
    }
    for (const row of next.progress) {
      db.runSync(
        'INSERT INTO award_progress_cache (owner_id, pet_id, counter_key, value, json) VALUES (?, ?, ?, ?, ?)',
        owner,
        row.petId ?? '',
        row.key,
        row.value,
        JSON.stringify(row),
      );
    }
    for (const def of next.definitions) {
      db.runSync('INSERT INTO award_definitions_cache (id, json) VALUES (?, ?)', def.id, JSON.stringify(def));
    }
    for (const row of next.worn) {
      db.runSync(
        'INSERT OR REPLACE INTO award_worn_cache (owner_id, pet_id, theme_id, piece_id) VALUES (?, ?, ?, ?)',
        owner,
        petId,
        row.themeId,
        row.pieceId,
      );
    }
    for (const row of next.themeRack) {
      db.runSync(
        'INSERT OR REPLACE INTO award_theme_rack_cache (theme_id, piece_id) VALUES (?, ?)',
        row.themeId,
        row.pieceId,
      );
    }
  });
}

export async function refreshAwardsCache(petId: string): Promise<AwardsCache> {
  const local = readAwardsCache(petId);
  const supabase = getSupabase();
  const userId = await getSessionUserId();
  const owner = cacheOwner(userId);
  if (!supabase || !userId || !owner) {
    return local;
  }
  const [defs, awards, progress, worn, costumes, rack] = await Promise.all([
    supabase.from('award_definitions').select('*'),
    supabase.from('awards').select('*').eq('player_id', userId).or(`pet_id.eq.${petId},pet_id.is.null`),
    supabase.from('award_progress').select('*').eq('player_id', userId).or(`pet_id.eq.${petId},pet_id.is.null`),
    supabase.from('runway_pieces_worn').select('theme_id, piece_id').eq('pet_id', petId),
    supabase.from('runway_costumes').select('id').eq('theme_specific', true),
    supabase.from('runway_theme_rack').select('theme_id, costume_id'),
  ]);
  if (defs.error || awards.error || progress.error) {
    return local;
  }
  const specific = new Set((costumes.data ?? []).map((row) => String((row as { id?: unknown }).id ?? '')));
  const themeRack: ThemeRackPiece[] = (rack.data ?? [])
    .map((row) => {
      const themeId = text((row as Record<string, unknown>).theme_id);
      const pieceId = text((row as Record<string, unknown>).costume_id);
      if (!themeId || !pieceId || (specific.size > 0 && !specific.has(pieceId))) {
        return null;
      }
      return { themeId, pieceId };
    })
    .filter((row): row is ThemeRackPiece => row != null);
  const next: AwardsCache = {
    definitions: (defs.data ?? []).map((row) => mapDefinitionRow(row as Record<string, unknown>)).filter((row): row is CachedDefinition => row != null),
    awards: (awards.data ?? []).map((row) => mapAwardRow(row as Record<string, unknown>)).filter((row): row is CachedAward => row != null),
    progress: (progress.data ?? []).map((row) => mapProgressRow(row as Record<string, unknown>)).filter((row): row is CachedProgress => row != null),
    worn: worn.error
      ? local.worn
      : (worn.data ?? [])
          .map((row) => {
            const themeId = text((row as Record<string, unknown>).theme_id);
            const pieceId = text((row as Record<string, unknown>).piece_id);
            return themeId && pieceId ? { themeId, pieceId } : null;
          })
          .filter((row): row is WornPiece => row != null),
    themeRack: costumes.error || rack.error ? local.themeRack : themeRack,
  };
  writeCache(owner, petId, next);
  return next;
}

export type RibbonFact = {
  raceId: string;
  event: string;
  classId: string;
  place: number;
};

function leftoverFact(row: { raceId: string; event: string; classId: string; place: number }): RibbonFact | null {
  if (!row.raceId || row.place < 1 || row.place > 3) {
    return null;
  }
  return { raceId: row.raceId, event: row.event, classId: row.classId, place: row.place };
}

function cacheFact(award: CachedAward): RibbonFact | null {
  if (award.definitionId !== 'ribbon' || !award.raceId || award.placing == null || award.placing < 1 || award.placing > 3) {
    return null;
  }
  return {
    raceId: award.raceId,
    event: text(award.snapshot.event_type ?? award.snapshot.event) ?? '',
    classId: text(award.snapshot.class ?? award.snapshot.classId) ?? '',
    place: award.placing,
  };
}

function readCacheSafe(petId: string): AwardsCache {
  try {
    return readAwardsCache(petId);
  } catch {
    return emptyAwardsCache();
  }
}

export function ribbonFacts(
  petId: string,
  leftoverStateRibbons?: { raceId: string; event: string; classId: string; place: number }[],
): RibbonFact[] {
  const byRace = new Map<string, RibbonFact>();
  for (const leftover of leftoverStateRibbons ?? []) {
    const fact = leftoverFact(leftover);
    if (fact && !byRace.has(fact.raceId)) {
      byRace.set(fact.raceId, fact);
    }
  }
  for (const award of readCacheSafe(petId).awards) {
    const fact = cacheFact(award);
    if (!fact) {
      continue;
    }
    const prior = byRace.get(fact.raceId);
    byRace.set(fact.raceId, {
      raceId: fact.raceId,
      event: fact.event || prior?.event || '',
      classId: fact.classId || prior?.classId || '',
      place: fact.place,
    });
  }
  return [...byRace.values()];
}

function withRaceContext(award: CachedAward, context?: { event?: string; classId?: string }): CachedAward {
  if (!context?.event || text(award.snapshot.event_type ?? award.snapshot.event)) {
    return award;
  }
  return {
    ...award,
    snapshot: {
      ...award.snapshot,
      event_type: context.event,
      class: award.snapshot.class ?? award.snapshot.classId ?? context.classId ?? null,
    },
  };
}

export function mergeRaceAwards(
  petId: string,
  rows: unknown[],
  context?: { event?: string; classId?: string },
): CachedAward[] {
  const incoming = (Array.isArray(rows) ? rows : [])
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => row != null)
    .map(mapAwardRow)
    .filter((row): row is CachedAward => row != null)
    .map((award) => withRaceContext(award, context));
  const owner = cacheOwner();
  if (!owner || incoming.length === 0) {
    return incoming;
  }
  const current = readAwardsCache(petId);
  const byId = new Map(current.awards.map((award) => [award.id, award]));
  for (const award of incoming) {
    byId.set(award.id, award);
  }
  writeCache(owner, petId, { ...current, awards: [...byId.values()] });
  return incoming;
}

export function mergeShowAwards(petId: string, rows: unknown[]): CachedAward[] {
  return mergeRaceAwards(petId, rows);
}
