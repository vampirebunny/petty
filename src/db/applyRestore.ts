import AsyncStorage from '@react-native-async-storage/async-storage';

import { furnitureDefinition } from '../actor/furniture';
import type { PetState } from '../sim/types';
import { createUuid } from '../compliance/identity';
import {
  setAccountHandle,
  setAccountLinked,
  setHandleSaved,
  setLocalRevision,
  setRestoreInProgress,
  setServerOffsetMs,
  setSyncedRevision,
} from './accountMeta';
import { setCurrentOwner } from './currentOwner';
import { getDb, transaction } from './database';
import { writeLedgerEntry, type LedgerLine } from './ledgerWrite';
import type { PlayerDoc, SpeciesId } from './playerHome';

export type RestoredLedgerEntry = {
  key: string;
  source: string;
  lines: LedgerLine[];
};

export type RestoredPet = {
  id: string;
  doc: PetState;
  retiredAt: number | null;
};

type Input = {
  userId: string;
  pet: PetState | null;
  retired: RestoredPet[];
  player: PlayerDoc | null;
  ledger: RestoredLedgerEntry[];
  serverRevision: number;
  hasHandle: boolean;
  serverNowMs: number;
  /** Anonymous reinstall installs the same rows and leaves the device a guest. */
  linkAccount?: boolean;
};

const clears = [
  'DELETE FROM transaction_lines',
  'DELETE FROM transactions',
  'DELETE FROM balances',
  'DELETE FROM inventory',
  'DELETE FROM owner_state',
  'DELETE FROM daily_counters',
  'DELETE FROM pet',
  'DELETE FROM retired_pets',
  'DELETE FROM owned_toys',
  'DELETE FROM owned_trick_props',
  'DELETE FROM owned_furniture',
  'DELETE FROM home_layouts',
  'DELETE FROM push_queue',
  'DELETE FROM ledger_outbox',
  'DELETE FROM shop_day',
  'DELETE FROM shop_pick_history',
];

function applyLine(owner: string, line: LedgerLine): void {
  if (line.delta === 0) {
    return;
  }
  const database = getDb();
  if (line.asset === 'boops') {
    const row = database.getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', owner);
    const next = (row?.boops ?? 0) + line.delta;
    database.runSync(
      `INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(owner_id) DO UPDATE SET boops = excluded.boops, updated_at = excluded.updated_at`,
      owner,
      next,
      new Date().toISOString(),
    );
    return;
  }
  if (line.asset === 'toy' && line.toyId && line.delta > 0) {
    database.runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', owner, line.toyId);
    return;
  }
  if (line.asset === 'trick_prop' && line.furnitureId && line.scene && line.toyId && line.delta > 0) {
    database.runSync(
      'INSERT OR IGNORE INTO owned_trick_props (owner_id, instance_id, prop_type, source_trick_id) VALUES (?, ?, ?, ?)',
      owner,
      line.furnitureId,
      line.scene,
      line.toyId,
    );
    return;
  }
  if (line.asset === 'furniture' && line.furnitureId && line.delta > 0) {
    const defined = furnitureDefinition(line.furnitureId);
    const piece = defined ?? { id: line.furnitureId, kind: 'bed' as const };
    database.runSync(
      'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
      owner,
      line.furnitureId,
      JSON.stringify(piece),
    );
    return;
  }
  const row = database.getFirstSync<{ quantity: number }>(
    'SELECT quantity FROM inventory WHERE owner_id = ? AND item_id = ?',
    owner,
    line.asset,
  );
  const next = (row?.quantity ?? 0) + line.delta;
  if (next <= 0) {
    database.runSync('DELETE FROM inventory WHERE owner_id = ? AND item_id = ?', owner, line.asset);
    return;
  }
  database.runSync(
    `INSERT INTO inventory (owner_id, item_id, quantity, first_acquired_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id, item_id) DO UPDATE SET quantity = excluded.quantity`,
    owner,
    line.asset,
    next,
    new Date().toISOString(),
  );
}

/** Replace this device's guest data with the account. NPC playdates are not on the server, so they start empty. */
export async function applyRestore(input: Input): Promise<void> {
  const database = getDb();
  setCurrentOwner(input.userId);
  transaction(() => {
    database.execSync(clears.join(';'));
    if (input.pet?.id) {
      database.runSync(
        'INSERT INTO pet (id, json, updated_at) VALUES (?, ?, ?)',
        input.pet.id,
        JSON.stringify(input.pet),
        Date.now(),
      );
    }
    for (const retired of input.retired) {
      database.runSync(
        'INSERT INTO retired_pets (id, json, retired_at) VALUES (?, ?, ?)',
        retired.id,
        JSON.stringify(retired.doc),
        retired.retiredAt,
      );
    }
    const owner = input.player?.ownerState;
    database.runSync(
      `INSERT INTO owner_state (
         owner_id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
         login_streak, login_last_claimed_day, last_open_at
       ) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      input.userId,
      owner?.timePaidThrough ?? Date.now(),
      owner?.timeCappedDay ?? null,
      owner?.lastTrustedTime ?? Date.now(),
      owner?.loginStreak ?? 0,
      owner?.loginLastClaimedDay ?? null,
      owner?.lastOpenAt ?? Date.now(),
    );
    const layouts = input.player?.layouts ?? {};
    for (const species of ['dog', 'cat'] as SpeciesId[]) {
      const placements = layouts[species];
      if (!placements) {
        continue;
      }
      database.runSync(
        'INSERT INTO home_layouts (owner_id, species, placements) VALUES (?, ?, ?)',
        input.userId,
        species,
        JSON.stringify(placements),
      );
    }
    if (input.player?.shopDay) {
      database.runSync(
        'INSERT INTO shop_day (owner_id, date, picks, deal_id) VALUES (?, ?, ?, ?)',
        input.userId,
        input.player.shopDay.date,
        input.player.shopDay.picks,
        input.player.shopDay.dealId,
      );
    }
    for (const pick of input.player?.shopPickHistory ?? []) {
      database.runSync(
        'INSERT INTO shop_pick_history (owner_id, date, slot, item_id) VALUES (?, ?, ?, ?)',
        input.userId,
        pick.date,
        pick.slot,
        pick.itemId,
      );
    }
    for (const counter of input.player?.dailyCounters ?? []) {
      database.runSync(
        'INSERT INTO daily_counters (day, pet_id, key, count) VALUES (?, ?, ?, ?)',
        counter.day,
        counter.petId,
        counter.key,
        counter.count,
      );
    }
    for (const entry of input.ledger) {
      const id = createUuid();
      writeLedgerEntry(input.userId, id, entry.source, entry.key, null, entry.lines, { outbox: false });
      for (const line of entry.lines) {
        applyLine(input.userId, line);
      }
    }
    const linkAccount = input.linkAccount !== false;
    setAccountHandle(null);
    setAccountLinked(linkAccount);
    setHandleSaved(linkAccount && input.hasHandle);
    setSyncedRevision(input.serverRevision);
    setLocalRevision(input.serverRevision + 1);
    setServerOffsetMs(input.serverNowMs - Date.now());
    setRestoreInProgress(null);
  });
  const keys = await AsyncStorage.getAllKeys();
  const drop = keys.filter((key) => key.startsWith('petty.playdates.') || key.startsWith('petty.wardrobe.'));
  if (drop.length > 0) {
    await AsyncStorage.multiRemove(drop);
  }
}
