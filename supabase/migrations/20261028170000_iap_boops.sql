-- Boops pack purchases. The service role inserts these ledger rows.
-- append_ledger_entries keeps rejecting them because iap is not an earn rule.

create table if not exists public.webhook_events (
  event_id text primary key,
  body jsonb not null,
  status text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.boops_packs (
  product_id text primary key,
  boops int not null check (boops > 0),
  tag text,
  sort_order int not null,
  active boolean not null default true,
  art_key text not null
);

insert into public.boops_packs (product_id, boops, tag, sort_order, art_key) values
  ('boops_600', 600, null, 1, 'boops_600'),
  ('boops_2000', 2000, null, 2, 'boops_2000'),
  ('boops_3500', 3500, 'Popular', 3, 'boops_3500'),
  ('boops_7500', 7500, null, 4, 'boops_7500'),
  ('boops_16000', 16000, null, 5, 'boops_16000'),
  ('boops_45000', 45000, 'Best value', 6, 'boops_45000')
on conflict (product_id) do update set
  boops = excluded.boops,
  tag = excluded.tag,
  sort_order = excluded.sort_order,
  art_key = excluded.art_key,
  active = true;

create table if not exists public.iap_events (
  transaction_id text not null,
  reason text not null check (reason in ('iap_purchase', 'iap_refund', 'iap_refund_reversed', 'sandbox_wipe')),
  user_id uuid not null references auth.users (id) on delete cascade,
  environment text,
  primary key (transaction_id, reason)
);

alter table public.webhook_events enable row level security;
alter table public.boops_packs enable row level security;
alter table public.iap_events enable row level security;

revoke all on public.webhook_events, public.iap_events from anon, authenticated;
revoke all on public.boops_packs from anon, authenticated;
grant select on public.boops_packs to authenticated;

drop policy if exists boops_packs_select on public.boops_packs;
create policy boops_packs_select on public.boops_packs
  for select to authenticated using (active);

-- One store transaction credits one player. A refund uses the original qty, not today's pack size.
create or replace function public.apply_iap_webhook(
  p_user_id uuid,
  p_transaction_id text,
  p_reason text,
  p_environment text,
  p_qty int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_user uuid;
  original int;
  target uuid;
  key text;
  kind text;
  reverses text;
  qty int;
begin
  if p_transaction_id is null or length(trim(p_transaction_id)) = 0 then
    return 'bad_qty';
  end if;
  if p_reason not in ('iap_purchase', 'iap_refund', 'iap_refund_reversed') then
    return 'bad_qty';
  end if;

  if exists (
    select 1 from public.iap_events
    where transaction_id = p_transaction_id and reason = p_reason
  ) then
    return 'duplicate';
  end if;

  if p_reason = 'iap_purchase' then
    if p_user_id is null or p_qty is null or p_qty <= 0 then
      return 'bad_qty';
    end if;
    target := p_user_id;
    key := p_transaction_id;
    kind := 'earn';
    reverses := null;
    qty := p_qty;
  elsif p_reason = 'iap_refund' then
    select user_id into existing_user
      from public.iap_events
      where transaction_id = p_transaction_id and reason = 'iap_purchase';
    if existing_user is null then
      return 'missing_purchase';
    end if;
    select coalesce(sum((line->>'qty')::int), 0) into original
      from public.ledger_entries as entry, jsonb_array_elements(entry.lines) as line
      where entry.user_id = existing_user
        and entry.idempotency_key = p_transaction_id
        and entry.source = 'iap_purchase'
        and line->>'asset' = 'boops';
    if original is null or original <= 0 then
      return 'missing_purchase';
    end if;
    target := existing_user;
    key := p_transaction_id || ':refund';
    kind := 'reversal';
    reverses := p_transaction_id;
    qty := -original;
  else
    select user_id into existing_user
      from public.iap_events
      where transaction_id = p_transaction_id and reason = 'iap_refund';
    if existing_user is null then
      return 'missing_refund';
    end if;
    select coalesce(sum((line->>'qty')::int), 0) into original
      from public.ledger_entries as entry, jsonb_array_elements(entry.lines) as line
      where entry.user_id = existing_user
        and entry.idempotency_key = p_transaction_id || ':refund'
        and entry.source = 'iap_refund'
        and line->>'asset' = 'boops';
    if original is null or original >= 0 then
      return 'missing_refund';
    end if;
    target := existing_user;
    key := p_transaction_id || ':refund_reversed';
    kind := 'earn';
    reverses := p_transaction_id || ':refund';
    qty := -original;
  end if;

  insert into public.iap_events (transaction_id, reason, user_id, environment)
  values (p_transaction_id, p_reason, target, nullif(p_environment, ''));

  insert into public.ledger_entries (
    user_id, idempotency_key, kind, source, lines, reverses_key
  ) values (
    target,
    key,
    kind,
    p_reason,
    jsonb_build_array(jsonb_build_object('asset', 'boops', 'qty', qty)),
    reverses
  );
  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;

revoke all on function public.apply_iap_webhook(uuid, text, text, text, int) from public, anon, authenticated;
grant execute on function public.apply_iap_webhook(uuid, text, text, text, int) to service_role;
