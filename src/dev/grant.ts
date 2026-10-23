import { grantOwnedFurniture, touchPlayerHome } from '../db/playerHome';
import { getDb } from '../db/database';
import { catalogItem } from '../economy/catalog';
import type { Equipped } from '../sim/types';
import { loadCloset, saveCloset } from '../storage/wardrobeStorage';

export async function grantDevItem(
  ownerId: string,
  species: 'dog' | 'cat',
  equipped: Equipped,
  id: string,
): Promise<void> {
  if (id === 'dogHouse' || id === 'catTree') {
    const sceneId = id === 'catTree' && species === 'cat' ? 'catio' : 'livingroom';
    grantOwnedFurniture(ownerId, species, id, sceneId);
    touchPlayerHome();
    return;
  }
  const item = catalogItem(id);
  if (!item) {
    return;
  }
  if (item.kind === 'outfit' && item.slot && item.wearId) {
    const closet = await loadCloset(ownerId, equipped);
    if (!closet.owned.some((owned) => owned.slot === item.slot && owned.id === item.wearId)) {
      closet.owned.push({ slot: item.slot, id: item.wearId });
      await saveCloset(ownerId, closet);
    }
    return;
  }
  if (item.kind === 'toy') {
    getDb().runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', ownerId, item.id);
    touchPlayerHome();
    return;
  }
  const owned = getDb().getFirstSync<{ quantity: number }>(
    'SELECT quantity FROM inventory WHERE owner_id = ? AND item_id = ?',
    ownerId,
    item.id,
  );
  if (owned) {
    getDb().runSync(
      'UPDATE inventory SET quantity = ? WHERE owner_id = ? AND item_id = ?',
      owned.quantity + 1,
      ownerId,
      item.id,
    );
  } else {
    getDb().runSync(
      'INSERT INTO inventory (owner_id, item_id, quantity, first_acquired_at) VALUES (?, ?, 1, ?)',
      ownerId,
      item.id,
      new Date().toISOString(),
    );
  }
  touchPlayerHome();
}
