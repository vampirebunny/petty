import {
  isRetiredPiece,
  placePiece,
  shopFurnitureSpot,
  starterFurniture,
  type FurniturePiece,
  type FurniturePlacement,
  type ShopFurnitureId,
} from '../actor/furniture';
import { startingToys } from '../sim/config';
import { getDb } from './database';

export type SpeciesId = 'dog' | 'cat';

export type PlayerDoc = {
  boops: number;
  inventory: { itemId: string; qty: number }[];
  ownerState: {
    timePaidThrough: number;
    timeCappedDay: string | null;
    lastTrustedTime: number;
    serverTimeOffsetMs: number;
    loginStreak: number;
    loginLastClaimedDay: string | null;
    lastOpenAt: number;
  } | null;
  toys: string[];
  furniture: FurniturePiece[];
  layouts: Partial<Record<SpeciesId, FurniturePlacement[]>>;
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
  getDb().runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', ownerId, toyId);
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
  for (const piece of starter.pieces) {
    database.runSync(
      'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
      ownerId,
      piece.id,
      JSON.stringify(piece),
    );
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
  const piece = { id: kind, kind };
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
  const owned = furnitureOf(ownerId).map((piece) => piece.id);
  const next = placePiece(layoutOf(ownerId, species), pieceId, sceneId, x, y, owned);
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

export function playerDoc(ownerId: string): PlayerDoc {
  const database = getDb();
  const balance = database.getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', ownerId);
  const inventory = database.getAllSync<{ item_id: string; quantity: number }>(
    'SELECT item_id, quantity FROM inventory WHERE owner_id = ? AND quantity > 0',
    ownerId,
  );
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
  return {
    boops: balance?.boops ?? 0,
    inventory: inventory.map((row) => ({ itemId: row.item_id, qty: row.quantity })),
    ownerState: owner
      ? {
          timePaidThrough: owner.time_paid_through,
          timeCappedDay: owner.time_capped_day,
          lastTrustedTime: owner.last_trusted_time,
          serverTimeOffsetMs: owner.server_time_offset_ms,
          loginStreak: owner.login_streak,
          loginLastClaimedDay: owner.login_last_claimed_day,
          lastOpenAt: owner.last_open_at,
        }
      : null,
    toys: toysOf(ownerId),
    furniture: furnitureOf(ownerId),
    layouts: layoutDoc,
  };
}
