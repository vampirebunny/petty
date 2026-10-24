-- Phase B: profiles, handle check, and a public health RPC.
-- Apply after 20261024200000_ledger_and_active_device.sql. Does not delete users.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  handle_lower text not null unique,
  handle_changed_at timestamptz,
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reserved_handles (
  handle_lower text primary key
);

create table public.handle_holds (
  handle_lower text primary key,
  released_at timestamptz not null
);

create table public.pending_guest_deletes (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create schema if not exists private;

create table private.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reserved_handles enable row level security;
alter table public.handle_holds enable row level security;
alter table public.pending_guest_deletes enable row level security;

revoke all on public.profiles, public.reserved_handles, public.handle_holds, public.pending_guest_deletes from anon, authenticated;
revoke all on private.apple_tokens from anon, authenticated, public;
grant select on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());

insert into public.reserved_handles (handle_lower) values
  ('admin'),
  ('boopboop'),
  ('support'),
  ('moderator'),
  ('official'),
  ('help'),
  ('fuck'),
  ('shit'),
  ('bitch'),
  ('asshole'),
  ('dick'),
  ('cock'),
  ('pussy'),
  ('slut'),
  ('whore'),
  ('nigger'),
  ('faggot'),
  ('retard')
on conflict (handle_lower) do nothing;

create or replace function public.normalize_handle(p_handle text)
returns text
language sql
immutable
as $$
  select translate(lower(p_handle), '013457', 'oieast');
$$;

create or replace function public.check_handle_available(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(p_handle);
  lowered text;
  normalized text;
begin
  if cleaned is null or cleaned !~ '^[a-zA-Z0-9]{3,20}$' then
    return 'invalid';
  end if;
  lowered := lower(cleaned);
  normalized := public.normalize_handle(cleaned);
  if exists (
    select 1 from public.reserved_handles
    where handle_lower = lowered or handle_lower = normalized
  ) then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where handle_lower = lowered)
    or exists (
      select 1 from public.handle_holds
      where handle_lower = lowered and released_at > now()
    ) then
    return 'taken';
  end if;
  return 'available';
end;
$$;

create or replace function public.app_health()
returns text
language sql
stable
security invoker
as $$
  select 'ok'::text;
$$;

create or replace function public.retire_limited_units(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.limited_units
    set status = 'released'
    where user_id = p_user_id and status = 'reserved';
  update public.limited_units
    set status = 'retired'
    where user_id = p_user_id and status = 'owned';
end;
$$;

create or replace function public.store_apple_refresh_token(p_user_id uuid, p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.apple_tokens (user_id, refresh_token)
  values (p_user_id, p_refresh_token)
  on conflict (user_id) do update set refresh_token = excluded.refresh_token, created_at = now();
end;
$$;

create or replace function public.read_apple_refresh_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  token text;
begin
  select refresh_token into token from private.apple_tokens where user_id = p_user_id;
  return token;
end;
$$;

revoke all on function public.normalize_handle(text) from public, anon;
revoke all on function public.check_handle_available(text) from public, anon;
revoke all on function public.app_health() from public;
revoke all on function public.retire_limited_units(uuid) from public, anon, authenticated;
revoke all on function public.store_apple_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.read_apple_refresh_token(uuid) from public, anon, authenticated;

grant execute on function public.check_handle_available(text) to authenticated;
grant execute on function public.app_health() to anon, authenticated;
grant select, insert, update, delete on public.pending_guest_deletes to service_role;
grant execute on function public.retire_limited_units(uuid) to service_role;
grant execute on function public.store_apple_refresh_token(uuid, text) to service_role;
grant execute on function public.read_apple_refresh_token(uuid) to service_role;
