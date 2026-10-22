-- Applied on hosted project unfatkwtzfkqnnbgzuqs. Do not re-apply.
-- See supabase/README.md.

create type public.pet_status as enum ('active', 'retired');

create table public.pets (
  id uuid primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  status public.pet_status not null default 'active',
  doc jsonb not null,
  doc_schema int not null,
  local_revision bigint not null,
  client_updated_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pets_owner_idx on public.pets (owner_user_id);

create unique index pets_one_active_per_owner
  on public.pets (owner_user_id) where status = 'active';

create table public.player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null,
  doc_schema int not null,
  local_revision bigint not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pets_touch_updated_at
  before update on public.pets
  for each row execute function public.touch_updated_at();

create trigger player_state_touch_updated_at
  before update on public.player_state
  for each row execute function public.touch_updated_at();

alter table public.pets enable row level security;
alter table public.player_state enable row level security;

revoke all on public.pets, public.player_state from anon, authenticated;
grant select on public.pets, public.player_state to authenticated;

create policy pets_select_own on public.pets
  for select to authenticated using (owner_user_id = auth.uid());

create policy player_state_select_own on public.player_state
  for select to authenticated using (user_id = auth.uid());

create or replace function public.push_active_pet(
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
begin
  if uid is null then
    raise exception 'not authenticated';
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

create or replace function public.retire_pet(
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
begin
  if uid is null then
    raise exception 'not authenticated';
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

create or replace function public.push_player_state(
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
begin
  if uid is null then
    raise exception 'not authenticated';
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

revoke all on function public.push_active_pet(uuid, jsonb, int, bigint, timestamptz) from public, anon;
revoke all on function public.retire_pet(uuid, jsonb, int, bigint, timestamptz) from public, anon;
revoke all on function public.push_player_state(jsonb, int, bigint, timestamptz) from public, anon;
grant execute on function public.push_active_pet(uuid, jsonb, int, bigint, timestamptz) to authenticated;
grant execute on function public.retire_pet(uuid, jsonb, int, bigint, timestamptz) to authenticated;
grant execute on function public.push_player_state(jsonb, int, bigint, timestamptz) to authenticated;
