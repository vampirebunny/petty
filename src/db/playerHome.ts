import {
  bowlAlreadyInRoom,
  furnitureDefinition,
  grantPieces,
  isRetiredPiece,
  placePiece,
  shopFurnitureSpot,
  stowPiece,
  starterFurniture,
  type FurniturePiece,
  type FurniturePlacement,
  type ShopFurnitureId,
} from '../actor/furniture';
import { startingToys } from '../sim/config';
import { getDb } from './database';
import { writeLedgerEntry } from './ledgerWrite';

export type SpeciesId = 'dog' | 'cat';

export type PlayerDoc = {
  ownerState: {
    timePaidThrough: number;
    timeCappedDay: string | null;
    lastTrustedTime: number;
    loginStreak: number;
    loginLastClaimedDay: string | null;
    lastOpenAt: number;
  } | null;
  layouts: Partial<Record<SpeciesId, FurniturePlacement[]>>;
  shopDay: { date: string; picks: string; dealId: string | null } | null;
  shopPickHistory: { date: string; slot: string; itemId: string }[];
  dailyCounters: { day: string; petId: string; key: string; count: number }[];
};

const listeners = new Set<() => void>();

export function subscribePlayerHome(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function touchPlayerHome(): void {
  emit();
}

export function trickPropsOf(ownerId: string): { instanceId: string; type: string; sourceTrickId: string }[] {
  const rows = getDb().getAllSync<{ instance_id: string; prop_type: string; source_trick_id: string }>(
    'SELECT instance_id, prop_type, source_trick_id FROM owned_trick_props WHERE owner_id = ?',
    ownerId,
  );
  return rows.map((row) => ({ instanceId: row.instance_id, type: row.prop_type, sourceTrickId: row.source_trick_id }));
}

export function toysOf(ownerId: string): string[] {
  const rows = getDb().getAllSync<{ toy_id: string }>('SELECT toy_id FROM owned_toys WHERE owner_id = ?', ownerId);
  return rows.map((row) => row.toy_id);
}

export function ownsToy(ownerId: string, toyId: string): boolean {
  const row = getDb().getFirstSync<{ toy_id: string }>(
    'SELECT toy_id FROM owned_toys WHERE owner_id = ? AND toy_id = ?',
    ownerId,
    toyId,
  );
  return row != null;
}

export function grantToyOnce(ownerId: string): void {
  const toyId = startingToys[0];
  const key = `toy:${toyId}`;
  const database = getDb();
  const taken = database.getFirstSync<{ id: string }>(
    'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
    ownerId,
    key,
  );
  if (taken) {
    return;
  }
  const id =
    globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `toy-${Date.now()}`;
  writeLedgerEntry(ownerId, id, 'starter_grant', key, null, [{ asset: 'toy', delta: 1, toyId }]);
  database.runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', ownerId, toyId);
  emit();
}

export function furnitureOf(ownerId: string): FurniturePiece[] {
  const rows = getDb().getAllSync<{ json: string }>('SELECT json FROM owned_furniture WHERE owner_id = ?', ownerId);
  return rows.map((row) => JSON.parse(row.json) as FurniturePiece).filter((piece) => !isRetiredPiece(piece.id));
}

export function layoutOf(ownerId: string, species: SpeciesId): FurniturePlacement[] {
  const row = getDb().getFirstSync<{ placements: string }>(
    'SELECT placements FROM home_layouts WHERE owner_id = ? AND species = ?',
    ownerId,
    species,
  );
  if (!row) {
    return [];
  }
  const parsed: unknown = JSON.parse(row.placements);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return (parsed as FurniturePlacement[]).filter((place) => !isRetiredPiece(place.pieceId));
}

export function hasLayout(ownerId: string, species: SpeciesId): boolean {
  const row = getDb().getFirstSync<{ species: string }>(
    'SELECT species FROM home_layouts WHERE owner_id = ? AND species = ?',
    ownerId,
    species,
  );
  return row != null;
}

// First pet of a species. Shared piece ids are inserted once. Placements go only into this species' layout.
export function grantSpeciesHome(ownerId: string, species: SpeciesId): void {
  const database = getDb();
  const starter = starterFurniture(species);
  const speciesOnly = grantPieces(species, 'species');
  const homeKey = `home:${species}`;
  const taken = database.getFirstSync<{ id: string }>(
    'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
    ownerId,
    homeKey,
  );
  if (!taken && speciesOnly.pieces.length > 0) {
    const id =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `home-${species}-${Date.now()}`;
    writeLedgerEntry(
      ownerId,
      id,
      'starter_grant',
      homeKey,
      null,
      speciesOnly.placed.map((place) => ({
        asset: 'furniture',
        delta: 1,
        furnitureId: place.pieceId,
        scene: place.sceneId,
      })),
    );
    for (const piece of speciesOnly.pieces) {
      const defined = furnitureDefinition(piece.id) ?? piece;
      database.runSync(
        'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
        ownerId,
        piece.id,
        JSON.stringify(defined),
      );
    }
  }
  if (!hasLayout(ownerId, species)) {
    database.runSync(
      'INSERT INTO home_layouts (owner_id, species, placements) VALUES (?, ?, ?)',
      ownerId,
      species,
      JSON.stringify(starter.placed),
    );
  }
  emit();
}

export function grantOwnedFurniture(ownerId: string, species: SpeciesId, kind: ShopFurnitureId, sceneId: string): void {
  const piece = kind === 'scratcher' ? { id: kind, kind, h: 74 } : { id: kind, kind };
  getDb().runSync(
    'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
    ownerId,
    kind,
    JSON.stringify(piece),
  );
  const spot = shopFurnitureSpot(kind, sceneId);
  moveOwnedPiece(ownerId, species, kind, spot.sceneId, spot.x, spot.y);
}

export function moveOwnedPiece(
  ownerId: string,
  species: SpeciesId,
  pieceId: string,
  sceneId: string,
  x: number,
  y: number,
): void {
  const pieces = furnitureOf(ownerId);
  const layout = layoutOf(ownerId, species);
  if (bowlAlreadyInRoom(pieces, layout, sceneId, pieceId)) {
    return;
  }
  const owned = pieces.map((piece) => piece.id);
  const next = placePiece(layout, pieceId, sceneId, x, y, owned);
  if (!next) {
    return;
  }
  const database = getDb();
  if (hasLayout(ownerId, species)) {
    database.runSync(
      'UPDATE home_layouts SET placements = ? WHERE owner_id = ? AND species = ?',
      JSON.stringify(next),
      ownerId,
      species,
    );
  } else {
    database.runSync(
      'INSERT INTO home_layouts (owner_id, species, placements) VALUES (?, ?, ?)',
      ownerId,
      species,
      JSON.stringify(next),
    );
  }
  emit();
}

export function stowOwnedPiece(ownerId: string, species: SpeciesId, pieceId: string): void {
  if (!hasLayout(ownerId, species)) {
    return;
  }
  const next = stowPiece(layoutOf(ownerId, species), pieceId);
  getDb().runSync(
    'UPDATE home_layouts SET placements = ? WHERE owner_id = ? AND species = ?',
    JSON.stringify(next),
    ownerId,
    species,
  );
  emit();
}

export function playerDoc(ownerId: string): PlayerDoc {
  const database = getDb();
  const owner = database.getFirstSync<{
    time_paid_through: number;
    time_capped_day: string | null;
    last_trusted_time: number;
    server_time_offset_ms: number;
    login_streak: number;
    login_last_claimed_day: string | null;
    last_open_at: number;
  }>('SELECT * FROM owner_state WHERE owner_id = ?', ownerId);
  const layouts = database.getAllSync<{ species: string; placements: string }>(
    'SELECT species, placements FROM home_layouts WHERE owner_id = ?',
    ownerId,
  );
  const layoutDoc: PlayerDoc['layouts'] = {};
  for (const row of layouts) {
    if (row.species === 'dog' || row.species === 'cat') {
      const parsed: unknown = JSON.parse(row.placements);
      layoutDoc[row.species] = Array.isArray(parsed) ? (parsed as FurniturePlacement[]) : [];
    }
  }
  const shop = database.getFirstSync<{ date: string; picks: string; deal_id: string | null }>(
    'SELECT date, picks, deal_id FROM shop_day WHERE owner_id = ?',
    ownerId,
  );
  const history = database.getAllSync<{ date: string; slot: string; item_id: string }>(
    'SELECT date, slot, item_id FROM shop_pick_history WHERE owner_id = ?',
    ownerId,
  );
  const counters = database.getAllSync<{ day: string; pet_id: string; key: string; count: number }>(
    'SELECT day, pet_id, key, count FROM daily_counters',
  );
  return {
    ownerState: owner
      ? {
          timePaidThrough: owner.time_paid_through,
          timeCappedDay: owner.time_capped_day,
          lastTrustedTime: owner.last_trusted_time,
          loginStreak: owner.login_streak,
          loginLastClaimedDay: owner.login_last_claimed_day,
          lastOpenAt: owner.last_open_at,
        }
      : null,
    layouts: layoutDoc,
    shopDay: shop ? { date: shop.date, picks: shop.picks, dealId: shop.deal_id } : null,
    shopPickHistory: history.map((row) => ({ date: row.date, slot: row.slot, itemId: row.item_id })),
    dailyCounters: counters.map((row) => ({ day: row.day, petId: row.pet_id, key: row.key, count: row.count })),
  };
}
