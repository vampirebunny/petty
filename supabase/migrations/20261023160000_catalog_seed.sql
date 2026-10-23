-- Catalog tiers, limited editions, and the public stock view.
-- Not applied yet. The project owner applies this with `supabase db push`.

alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items drop constraint if exists shop_items_shop_check;

alter table public.shop_items
  add column if not exists tier text not null default 'standard',
  add column if not exists cap int;

alter table public.shop_items
  add constraint shop_items_category_check
  check (category in ('treats', 'clothes', 'toys', 'boosts', 'home'));

alter table public.shop_items
  add constraint shop_items_shop_check
  check (shop in ('always', 'rotation', 'coming_soon', 'hidden', 'featured'));

alter table public.shop_items
  add constraint shop_items_tier_check
  check (tier in ('standard', 'exclusive', 'limited'));

alter table public.shop_items
  add constraint shop_items_cap_check
  check (
    (tier = 'limited' and cap is not null and cap > 0)
    or (tier <> 'limited' and cap is null)
  );

create table public.limited_editions (
  item_id text primary key references public.shop_items (id),
  cap int not null check (cap > 0),
  sold_out_at timestamptz
);

-- user_id is not a foreign key. Deleting an account must not drop the serial row.
create table public.limited_units (
  item_id text not null references public.limited_editions (item_id),
  serial int not null check (serial > 0),
  user_id uuid not null,
  request_id text not null,
  status text not null check (status in ('reserved', 'owned', 'released', 'retired')),
  reserved_at timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key (item_id, serial)
);

create unique index limited_units_one_per_player
  on public.limited_units (item_id, user_id)
  where status in ('reserved', 'owned');

alter table public.limited_editions enable row level security;
alter table public.limited_units enable row level security;

revoke all on public.limited_editions, public.limited_units from anon, authenticated;

-- Counts only. security_invoker stays off so anon can read the count without seeing who owns a serial.
create view public.limited_stock
with (security_invoker = false) as
select
  edition.item_id,
  edition.cap,
  edition.cap - coalesce((
    select count(*)::int
    from public.limited_units unit
    where unit.item_id = edition.item_id
      and (
        unit.status in ('owned', 'retired')
        or (unit.status = 'reserved' and unit.reserved_at >= now() - interval '10 minutes')
      )
  ), 0) as units_left,
  edition.sold_out_at
from public.limited_editions edition;

revoke all on public.limited_stock from public;
grant select on public.limited_stock to anon, authenticated;

create or replace function public.reserve_limited(p_item_id text, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  edition public.limited_editions%rowtype;
  held public.limited_units%rowtype;
  next_serial int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception 'missing request';
  end if;

  select * into edition from public.limited_editions where item_id = p_item_id;
  if not found then
    return jsonb_build_object('status', 'sold_out');
  end if;

  select * into held
  from public.limited_units
  where item_id = p_item_id and user_id = uid and status = 'owned'
  limit 1;
  if found then
    return jsonb_build_object('status', 'already_owned', 'serial', held.serial);
  end if;

  select * into held
  from public.limited_units
  where item_id = p_item_id and user_id = uid and request_id = p_request_id and status = 'reserved'
  limit 1;
  if found then
    return jsonb_build_object('status', 'reserved', 'serial', held.serial);
  end if;

  select * into held
  from public.limited_units
  where item_id = p_item_id
    and user_id = uid
    and status = 'reserved'
    and reserved_at >= now() - interval '10 minutes'
  limit 1;
  if found then
    return jsonb_build_object('status', 'in_progress');
  end if;

  select * into edition from public.limited_editions where item_id = p_item_id for update;

  select * into held
  from public.limited_units
  where item_id = p_item_id
    and user_id = uid
    and status = 'reserved'
    and reserved_at < now() - interval '10 minutes'
  for update;
  if found then
    update public.limited_units
    set request_id = p_request_id, reserved_at = now()
    where item_id = held.item_id and serial = held.serial;
    return jsonb_build_object('status', 'reserved', 'serial', held.serial);
  end if;

  select * into held
  from public.limited_units
  where item_id = p_item_id
    and (
      status = 'released'
      or (status = 'reserved' and reserved_at < now() - interval '10 minutes')
    )
  order by serial asc
  for update
  limit 1;
  if found then
    update public.limited_units
    set user_id = uid,
        request_id = p_request_id,
        status = 'reserved',
        reserved_at = now(),
        confirmed_at = null
    where item_id = held.item_id and serial = held.serial;
    return jsonb_build_object('status', 'reserved', 'serial', held.serial);
  end if;

  select coalesce(max(serial), 0) + 1 into next_serial
  from public.limited_units
  where item_id = p_item_id;
  if next_serial <= edition.cap then
    insert into public.limited_units (item_id, serial, user_id, request_id, status, reserved_at)
    values (p_item_id, next_serial, uid, p_request_id, 'reserved', now());
    return jsonb_build_object('status', 'reserved', 'serial', next_serial);
  end if;

  return jsonb_build_object('status', 'sold_out');
end;
$$;

create or replace function public.confirm_limited(p_item_id text, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  held public.limited_units%rowtype;
  edition public.limited_editions%rowtype;
  filled int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into edition from public.limited_editions where item_id = p_item_id for update;
  if not found then
    return jsonb_build_object('status', 'lost');
  end if;

  select * into held
  from public.limited_units
  where item_id = p_item_id and user_id = uid and request_id = p_request_id and status = 'owned'
  for update;
  if not found then
    select * into held
    from public.limited_units
    where item_id = p_item_id and user_id = uid and request_id = p_request_id and status = 'reserved'
    for update;
    if not found then
      return jsonb_build_object('status', 'lost');
    end if;
    update public.limited_units
    set status = 'owned', confirmed_at = now()
    where item_id = held.item_id and serial = held.serial;
  end if;

  select count(*)::int into filled
  from public.limited_units
  where item_id = p_item_id and status in ('owned', 'retired');
  if filled >= edition.cap then
    update public.limited_editions
    set sold_out_at = coalesce(sold_out_at, now())
    where item_id = p_item_id;
  end if;

  return jsonb_build_object('status', 'confirmed', 'serial', held.serial);
end;
$$;

create or replace function public.release_limited(p_item_id text, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  update public.limited_units
  set status = 'released'
  where item_id = p_item_id
    and user_id = uid
    and request_id = p_request_id
    and status = 'reserved';
  return jsonb_build_object('status', 'released');
end;
$$;

revoke all on function public.reserve_limited(text, text) from public, anon;
revoke all on function public.confirm_limited(text, text) from public, anon;
revoke all on function public.release_limited(text, text) from public, anon;
grant execute on function public.reserve_limited(text, text) to authenticated;
grant execute on function public.confirm_limited(text, text) to authenticated;
grant execute on function public.release_limited(text, text) to authenticated;

create or replace function public.delete_my_guest_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  anon boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select is_anonymous into anon from auth.users where id = uid;
  if anon is not true then
    raise exception 'not an anonymous user';
  end if;

  update public.limited_units
  set status = 'released'
  where user_id = uid and status = 'reserved';
  update public.limited_units
  set status = 'retired'
  where user_id = uid and status = 'owned';

  delete from auth.users where id = uid;
end;
$$;
