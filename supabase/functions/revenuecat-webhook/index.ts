import { productCandidates, planIapEvent, type IapPlan } from '../_shared/iapEvent.ts';
import { adminClient, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  if (!authorized(req)) {
    return json({ error: 'not authorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad body' }, 400);
  }

  const { eventId, plan } = planIapEvent(body);
  if (!eventId) {
    return json({ error: 'missing event' }, 400);
  }

  const admin = adminClient();
  const saved = await admin.from('webhook_events').insert({ event_id: eventId, body, status: 'received' });
  if (saved.error && saved.error.code !== '23505') {
    console.error('webhook_events insert failed', saved.error.message);
    return json({ error: 'unavailable' }, 500);
  }
  if (saved.error?.code === '23505') {
    const existing = await admin.from('webhook_events').select('status').eq('event_id', eventId).maybeSingle();
    const status = existing.data?.status;
    if (status && status !== 'failed' && status !== 'received') {
      return json({ ok: true });
    }
  }

  if (plan.action === 'ignore') {
    await mark(admin, eventId, 'ignored');
    return json({ ok: true });
  }

  const outcome = plan.action === 'retry' ? 'retry' : await credit(admin, plan);
  if (outcome === 'ok' || outcome === 'duplicate') {
    await mark(admin, eventId, 'ok');
    return json({ ok: true });
  }
  await mark(admin, eventId, 'failed');
  return json({ error: outcome }, 500);
});

function authorized(req: Request): boolean {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const header = req.headers.get('Authorization') ?? '';
  if (!expected || !header) {
    return false;
  }
  return same(header, expected) || same(header, `Bearer ${expected}`);
}

function same(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

async function credit(
  admin: ReturnType<typeof adminClient>,
  plan: Extract<IapPlan, { action: 'credit' }>,
): Promise<'ok' | 'duplicate' | 'retry'> {
  let userId: string | null = null;
  let qty = 0;
  if (plan.reason === 'iap_purchase') {
    userId = await firstUser(admin, plan.userIds);
    qty = userId ? await packQty(admin, plan.productId ?? '') : 0;
    if (!userId || qty <= 0) {
      return 'retry';
    }
  }

  const applied = await admin.rpc('apply_iap_webhook', {
    p_user_id: userId,
    p_transaction_id: plan.transactionId,
    p_reason: plan.reason,
    p_environment: plan.environment,
    p_qty: qty,
  });
  if (applied.error) {
    console.error('apply_iap_webhook failed', applied.error.message);
    return 'retry';
  }
  if (applied.data === 'ok' || applied.data === 'duplicate') {
    return applied.data;
  }
  console.error(`apply_iap_webhook returned ${String(applied.data)} for ${plan.transactionId}`);
  return 'retry';
}

async function firstUser(admin: ReturnType<typeof adminClient>, ids: string[]): Promise<string | null> {
  for (const id of ids) {
    const found = await admin.auth.admin.getUserById(id);
    if (!found.error && found.data.user) {
      return found.data.user.id;
    }
  }
  return null;
}

async function packQty(admin: ReturnType<typeof adminClient>, productId: string): Promise<number> {
  for (const candidate of productCandidates(productId)) {
    const row = await admin.from('boops_packs').select('boops').eq('product_id', candidate).eq('active', true).maybeSingle();
    if (typeof row.data?.boops === 'number' && row.data.boops > 0) {
      return row.data.boops;
    }
  }
  return 0;
}

async function mark(admin: ReturnType<typeof adminClient>, eventId: string, status: string): Promise<void> {
  const updated = await admin.from('webhook_events').update({ status }).eq('event_id', eventId);
  if (updated.error) {
    console.error('webhook_events status update failed', updated.error.message);
  }
}
