export type IapReason = 'iap_purchase' | 'iap_refund' | 'iap_refund_reversed';

export type IapPlan =
  | { action: 'ignore' }
  | { action: 'retry' }
  | {
      action: 'credit';
      reason: IapReason;
      transactionId: string;
      productId: string | null;
      userIds: string[];
      environment: string | null;
    };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function planIapEvent(body: unknown): { eventId: string | null; plan: IapPlan } {
  const event = eventObject(body);
  const eventId = textAt(event, 'id');
  const type = textAt(event, 'type');
  if (!eventId || !type || type === 'TEST' || type === 'TRANSFER') {
    return { eventId, plan: { action: 'ignore' } };
  }
  if (type !== 'NON_RENEWING_PURCHASE' && type !== 'CANCELLATION' && type !== 'REFUND_REVERSED') {
    return { eventId, plan: { action: 'ignore' } };
  }
  const transactionId = textAt(event, 'transaction_id');
  if (!transactionId) {
    return { eventId, plan: { action: 'retry' } };
  }
  const reason: IapReason =
    type === 'NON_RENEWING_PURCHASE' ? 'iap_purchase' : type === 'CANCELLATION' ? 'iap_refund' : 'iap_refund_reversed';
  const productId = textAt(event, 'product_id');
  const ids = userIds(event);
  if (reason === 'iap_purchase' && (!productId || ids.length === 0)) {
    return { eventId, plan: { action: 'retry' } };
  }
  return {
    eventId,
    plan: {
      action: 'credit',
      reason,
      transactionId,
      productId,
      userIds: ids,
      environment: textAt(event, 'environment'),
    },
  };
}

/** Store ids sometimes arrive as product:base-plan. The pack id is the first piece. */
export function productCandidates(productId: string): string[] {
  const exact = productId.trim();
  const head = exact.split(':')[0]?.trim() ?? '';
  if (head && head !== exact) {
    return [exact, head];
  }
  return exact ? [exact] : [];
}

function eventObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const record = body as Record<string, unknown>;
  const event = record.event;
  if (event && typeof event === 'object') {
    return event as Record<string, unknown>;
  }
  return record;
}

function textAt(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function userIds(event: Record<string, unknown>): string[] {
  const ordered = [event.app_user_id, ...aliasList(event.aliases), event.original_app_user_id];
  const ids: string[] = [];
  for (const value of ordered) {
    if (typeof value !== 'string' || !uuidPattern.test(value) || ids.includes(value)) {
      continue;
    }
    ids.push(value);
  }
  return ids;
}

function aliasList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
