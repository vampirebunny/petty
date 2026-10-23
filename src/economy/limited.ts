import { ensureAnonymousUserId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import {
  forgetLimitedConfirm,
  pendingLimitedConfirms,
  purchaseLimited,
  rememberLimitedConfirm,
  reverseLimited,
} from './service';
import { refreshLimitedStock } from './shopSync';

export type ReserveStatus = 'already_owned' | 'reserved' | 'in_progress' | 'sold_out';

type RpcStatus = ReserveStatus | 'confirmed' | 'lost' | 'released';

async function callLimited(
  name: 'reserve_limited' | 'confirm_limited' | 'release_limited',
  itemId: string,
  requestId: string,
): Promise<{ status: RpcStatus; serial?: number } | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc(name, { p_item_id: itemId, p_request_id: requestId });
  if (error || !data || typeof data !== 'object') {
    return null;
  }
  const row = data as { status?: unknown; serial?: unknown };
  if (typeof row.status !== 'string') {
    return null;
  }
  return {
    status: row.status as RpcStatus,
    serial: typeof row.serial === 'number' ? row.serial : undefined,
  };
}

export async function buyLimited(
  itemId: string,
  price: number,
  requestId: string,
): Promise<
  | { ok: true; status: 'already_owned' | 'in_progress' | 'sold_out' | 'confirmed'; serial?: number }
  | { ok: false; reason: 'offline' | 'lost' | 'insufficient_boops' | 'unknown' }
> {
  const userId = await ensureAnonymousUserId();
  if (!userId) {
    return { ok: false, reason: 'offline' };
  }
  const reserved = await callLimited('reserve_limited', itemId, requestId);
  if (!reserved) {
    return { ok: false, reason: 'offline' };
  }
  if (reserved.status !== 'reserved') {
    await refreshLimitedStock();
    return { ok: true, status: reserved.status as 'already_owned' | 'in_progress' | 'sold_out', serial: reserved.serial };
  }
  const serial = reserved.serial ?? 0;
  const paid = purchaseLimited(itemId, price, serial, requestId);
  if (!paid.ok) {
    await callLimited('release_limited', itemId, requestId);
    return { ok: false, reason: paid.reason === 'insufficient_boops' ? 'insufficient_boops' : 'unknown' };
  }
  rememberLimitedConfirm(requestId, itemId, price, serial);
  const confirmed = await callLimited('confirm_limited', itemId, requestId);
  if (!confirmed) {
    return { ok: true, status: 'confirmed', serial };
  }
  if (confirmed.status === 'lost') {
    forgetLimitedConfirm(requestId);
    reverseLimited(itemId, price, requestId);
    await refreshLimitedStock();
    return { ok: false, reason: 'lost' };
  }
  forgetLimitedConfirm(requestId);
  await refreshLimitedStock();
  return { ok: true, status: 'confirmed', serial };
}

// Launch retries confirm only. A lost confirm undoes the local grant.
export async function resumeLimitedPurchases(): Promise<{ unequipCrown: boolean; lost: boolean }> {
  let unequipCrown = false;
  let lost = false;
  for (const pending of pendingLimitedConfirms()) {
    const confirmed = await callLimited('confirm_limited', pending.itemId, pending.requestId);
    if (!confirmed) {
      continue;
    }
    if (confirmed.status === 'lost') {
      reverseLimited(pending.itemId, pending.price, pending.requestId);
      forgetLimitedConfirm(pending.requestId);
      unequipCrown = unequipCrown || pending.itemId === 'hat:crown';
      lost = true;
    } else if (confirmed.status === 'confirmed') {
      forgetLimitedConfirm(pending.requestId);
    }
  }
  return { unequipCrown, lost };
}
