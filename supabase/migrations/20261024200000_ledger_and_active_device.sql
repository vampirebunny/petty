-- Phase A: ledger, earn rules, and one active device.
-- Apply on the hosted project. Does not delete auth.users.

alter table public.player_state
  add column if not exists active_device_id text,
  add column if not exists active_since timestamptz,
  add column if not exists last_seen timestamptz,
  add column if not exists active_device_label text;

create table if not exists public.ledger_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  kind text not null check (kind in ('purchase', 'spend', 'earn', 'consume', 'reversal')),
  source text not null,
  lines jsonb not null default '[]',
  reverses_key text,
  local_day text,
  flags text[] not null default '{}',
  device_id text,
  device_time timestamptz,
  server_time timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create table if not exists public.earn_rules (
  source text not null,
  key_prefix text not null,
  max_amount int,
  primary key (source, key_prefix)
);

insert into public.earn_rules (source, key_prefix, max_amount) values
  ('starter_grant', 'starter', 1000),
  ('starter_grant', 'closet_import', null),
  ('starter_grant', 'home:', null),
  ('starter_grant', 'toy:', 1),
  ('time_payout', 'time:', 480),
  ('daily_login', 'login:', 100),
  ('level_up', 'level:', 50),
  ('milestone', 'stage:', 200),
  ('milestone', 'milestone:trick:', 100),
  ('play_find', 'find:', 10),
  ('welcome_back', 'welcome:', 150),
  ('playdate', 'playdate:', 30)
on conflict (source, key_prefix) do update set max_amount = excluded.max_amount;

create table if not exists public.claim_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_id)
);

alter table public.ledger_entries enable row level security;
alter table public.earn_rules enable row level security;
alter table public.claim_results enable row level security;

revoke all on public.ledger_entries, public.earn_rules, public.claim_results from anon, authenticated;
grant select on public.ledger_entries, public.earn_rules to authenticated;

drop policy if exists ledger_select_own on public.ledger_entries;
create policy ledger_select_own on public.ledger_entries
  for select to authenticated using (user_id = auth.uid());

drop policy if exists earn_rules_select on public.earn_rules;
create policy earn_rules_select on public.earn_rules
  for select to authenticated using (true);

create or replace function public.device_gate(p_device_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  active text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select active_device_id into active from public.player_state where user_id = uid;
  if active is not null and active is distinct from p_device_id then
    return 'not_active';
  end if;
  return null;
end;
$$;

drop function if exists public.push_active_pet(uuid, jsonb, int, bigint, timestamptz);
create or replace function public.push_active_pet(
  p_device_id text,
  p_id uuid,
  p_doc jsonb,
  p_doc_schema int,
  p_local_revision bigint,
  p_client_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.pets%rowtype;
  other public.pets%rowtype;
  gate text;
begin
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return gate;
  end if;
  if p_doc->>'ownerId' is distinct from uid::text then
    raise exception 'owner mismatch';
  end if;

  select * into existing from public.pets where id = p_id;
  if found and existing.owner_user_id <> uid then
    raise exception 'not owner';
  end if;
  if found and existing.status = 'retired' then
    raise exception 'retired';
  end if;
  if found and existing.local_revision > p_local_revision then
    return 'stale';
  end if;
  if found and existing.local_revision = p_local_revision then
    return 'ok';
  end if;

  select * into other from public.pets
    where owner_user_id = uid and status = 'active' and id <> p_id;
  if found and other.local_revision >= p_local_revision then
    return 'stale';
  end if;
  if found then
    update public.pets
      set status = 'retired', retired_at = now()
      where id = other.id;
  end if;

  insert into public.pets (
    id, owner_user_id, status, doc, doc_schema, local_revision, client_updated_at
  ) values (
    p_id, uid, 'active', p_doc, p_doc_schema, p_local_revision, p_client_updated_at
  )
  on conflict (id) do update set
    status = 'active',
    doc = excluded.doc,
    doc_schema = excluded.doc_schema,
    local_revision = excluded.local_revision,
    client_updated_at = excluded.client_updated_at
  where public.pets.local_revision < excluded.local_revision;

  return 'ok';
end;
$$;

drop function if exists public.retire_pet(uuid, jsonb, int, bigint, timestamptz);
create or replace function public.retire_pet(
  p_device_id text,
  p_id uuid,
  p_doc jsonb,
  p_doc_schema int,
  p_local_revision bigint,
  p_client_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.pets%rowtype;
  gate text;
begin
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return gate;
  end if;
  if p_doc->>'ownerId' is distinct from uid::text then
    raise exception 'owner mismatch';
  end if;

  select * into existing from public.pets where id = p_id;
  if found and existing.owner_user_id <> uid then
    raise exception 'not owner';
  end if;
  if found and existing.local_revision > p_local_revision then
    return 'stale';
  end if;
  if found and existing.local_revision = p_local_revision then
    return 'ok';
  end if;

  insert into public.pets (
    id, owner_user_id, status, doc, doc_schema, local_revision, client_updated_at, retired_at
  ) values (
    p_id, uid, 'retired', p_doc, p_doc_schema, p_local_revision, p_client_updated_at, now()
  )
  on conflict (id) do update set
    status = 'retired',
    doc = excluded.doc,
    doc_schema = excluded.doc_schema,
    local_revision = excluded.local_revision,
    client_updated_at = excluded.client_updated_at,
    retired_at = coalesce(public.pets.retired_at, now())
  where public.pets.local_revision < excluded.local_revision;

  return 'ok';
end;
$$;

drop function if exists public.push_player_state(jsonb, int, bigint, timestamptz);
create or replace function public.push_player_state(
  p_device_id text,
  p_doc jsonb,
  p_doc_schema int,
  p_local_revision bigint,
  p_client_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.player_state%rowtype;
  gate text;
begin
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return gate;
  end if;

  select * into existing from public.player_state where user_id = uid;
  if found and existing.local_revision > p_local_revision then
    return 'stale';
  end if;
  if found and existing.local_revision = p_local_revision then
    return 'ok';
  end if;

  insert into public.player_state (user_id, doc, doc_schema, local_revision, client_updated_at)
  values (uid, p_doc, p_doc_schema, p_local_revision, p_client_updated_at)
  on conflict (user_id) do update set
    doc = excluded.doc,
    doc_schema = excluded.doc_schema,
    local_revision = excluded.local_revision,
    client_updated_at = excluded.client_updated_at
  where public.player_state.local_revision < excluded.local_revision;

  return 'ok';
end;
$$;

create or replace function public.peek_active_device()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.player_state%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into row from public.player_state where user_id = uid;
  return jsonb_build_object(
    'active_device_id', row.active_device_id,
    'active_device_label', row.active_device_label,
    'last_seen', row.last_seen
  );
end;
$$;

create or replace function public.claim_device(
  p_device_id text,
  p_claim_id uuid,
  p_device_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.claim_results%rowtype;
  before_id text;
  before_seen timestamptz;
  revision bigint;
  handle_saved boolean;
  result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_device_label not in ('iPhone', 'iPad', 'Android') then
    raise exception 'bad device label';
  end if;

  select * into existing from public.claim_results where user_id = uid and claim_id = p_claim_id;
  if found then
    return existing.result;
  end if;

  select active_device_id, last_seen into before_id, before_seen
    from public.player_state where user_id = uid;
  select coalesce(max(local_revision), 0) into revision from (
    select local_revision from public.pets where owner_user_id = uid
    union all
    select local_revision from public.player_state where user_id = uid
  ) revisions;
  begin
    select exists(select 1 from public.profiles where user_id = uid and handle is not null) into handle_saved;
  exception when undefined_table then
    handle_saved := false;
  end;

  result := jsonb_build_object(
    'active_device_id_before', before_id,
    'last_seen_before', before_seen,
    'server_now', now(),
    'server_revision', revision,
    'has_handle', coalesce(handle_saved, false)
  );

  insert into public.claim_results (user_id, claim_id, result)
  values (uid, p_claim_id, result);

  insert into public.player_state (user_id, doc, doc_schema, local_revision, client_updated_at, active_device_id, active_since, last_seen, active_device_label)
  values (uid, '{}'::jsonb, 2, 0, now(), p_device_id, now(), now(), p_device_label)
  on conflict (user_id) do update set
    active_device_id = excluded.active_device_id,
    active_since = now(),
    last_seen = now(),
    active_device_label = excluded.active_device_label;

  return result;
end;
$$;

create or replace function public.touch_last_seen(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  update public.player_state
    set last_seen = now()
    where user_id = uid and active_device_id = p_device_id;
end;
$$;

create or replace function public.pull_account_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pet public.pets%rowtype;
  player public.player_state%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into pet from public.pets where owner_user_id = uid and status = 'active' limit 1;
  select * into player from public.player_state where user_id = uid;
  return jsonb_build_object(
    'pet', pet.doc,
    'player', player.doc,
    'server_now', now(),
    'server_revision', greatest(coalesce(pet.local_revision, 0), coalesce(player.local_revision, 0)),
    'active_device_id', player.active_device_id,
    'active_device_label', player.active_device_label,
    'last_seen', player.last_seen,
    'has_handle', false
  );
end;
$$;

create or replace function public.append_ledger_entries(
  p_device_id text,
  p_entries jsonb,
  p_replay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gate text;
  entry jsonb;
  results jsonb := '[]'::jsonb;
  key text;
  kind text;
  source text;
  lines jsonb;
  boops int;
  rule_max int;
  prefix text;
  status text;
  flags text[] := '{}';
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return to_jsonb(gate);
  end if;

  for entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    key := entry->>'idempotency_key';
    kind := entry->>'kind';
    source := entry->>'source';
    lines := coalesce(entry->'lines', '[]'::jsonb);
    status := 'ok';
    flags := '{}';

    if exists(select 1 from public.ledger_entries where user_id = uid and idempotency_key = key) then
      results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', 'duplicate'));
      continue;
    end if;

    if kind is null or kind not in ('purchase', 'spend', 'earn', 'consume', 'reversal') or key is null then
      status := 'invalid';
    elsif p_replay and kind not in ('purchase', 'spend', 'reversal') then
      status := 'invalid';
    elsif kind = 'earn' then
      select key_prefix, max_amount into prefix, rule_max
        from public.earn_rules
        where earn_rules.source = source and key like key_prefix || '%'
        order by length(key_prefix) desc
        limit 1;
      if prefix is null then
        status := 'invalid';
      elsif rule_max is not null then
        select coalesce(sum((line->>'qty')::int), 0) into boops
          from jsonb_array_elements(lines) line
          where line->>'asset' = 'boops';
        if boops > rule_max then
          status := 'invalid';
        end if;
      end if;
    elsif kind in ('purchase', 'spend') then
      select coalesce(sum((line->>'qty')::int), 0) into boops
        from jsonb_array_elements(lines) line
        where line->>'asset' = 'boops';
      if boops > 0 then
        status := 'invalid';
      elsif boops = 0 and exists (
        select 1 from jsonb_array_elements(lines) line
        where line->>'asset' in ('toy', 'furniture') and coalesce((line->>'qty')::int, 0) > 0
      ) then
        status := 'invalid';
      end if;
    end if;

    if status = 'ok' then
      insert into public.ledger_entries (
        user_id, idempotency_key, kind, source, lines, reverses_key, local_day, flags, device_id, device_time
      ) values (
        uid,
        key,
        kind,
        source,
        lines,
        entry->>'reverses_key',
        entry->>'local_day',
        flags,
        p_device_id,
        nullif(entry->>'device_time', '')::timestamptz
      );
    end if;

    results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', status, 'flags', flags));
  end loop;

  return results;
end;
$$;

revoke all on function public.push_active_pet(text, uuid, jsonb, int, bigint, timestamptz) from public, anon;
revoke all on function public.retire_pet(text, uuid, jsonb, int, bigint, timestamptz) from public, anon;
revoke all on function public.push_player_state(text, jsonb, int, bigint, timestamptz) from public, anon;
revoke all on function public.peek_active_device() from public, anon;
revoke all on function public.claim_device(text, uuid, text) from public, anon;
revoke all on function public.touch_last_seen(text) from public, anon;
revoke all on function public.pull_account_state() from public, anon;
revoke all on function public.append_ledger_entries(text, jsonb, boolean) from public, anon;
revoke all on function public.device_gate(text) from public, anon;

grant execute on function public.push_active_pet(text, uuid, jsonb, int, bigint, timestamptz) to authenticated;
grant execute on function public.retire_pet(text, uuid, jsonb, int, bigint, timestamptz) to authenticated;
grant execute on function public.push_player_state(text, jsonb, int, bigint, timestamptz) to authenticated;
grant execute on function public.peek_active_device() to authenticated;
grant execute on function public.claim_device(text, uuid, text) to authenticated;
grant execute on function public.touch_last_seen(text) to authenticated;
grant execute on function public.pull_account_state() to authenticated;
grant execute on function public.append_ledger_entries(text, jsonb, boolean) to authenticated;
