-- Remote item definitions. A published def is immutable. Clients still cannot write.

alter table public.shop_items
  add column if not exists def jsonb,
  add column if not exists min_app_version text,
  add column if not exists def_locked boolean not null default false;

alter table public.shop_items drop constraint if exists shop_items_price_check;
alter table public.shop_items
  add constraint shop_items_price_check
  check (price is null or price >= 0);

alter table public.shop_items drop constraint if exists shop_items_exclusive_shop_check;
alter table public.shop_items
  add constraint shop_items_exclusive_shop_check
  check (tier <> 'exclusive' or shop in ('rotation', 'hidden', 'coming_soon'));

alter table public.shop_bundles drop constraint if exists shop_bundles_contents_check;
alter table public.shop_bundles
  add constraint shop_bundles_contents_check
  check (jsonb_typeof(contents) = 'array' and jsonb_array_length(contents) > 0);

create or replace function public.lock_shop_item_def()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.def_locked and new.def is distinct from old.def then
    raise exception 'shop item def is locked';
  end if;
  if new.def is not null and new.shop in ('always', 'rotation', 'featured') then
    new.def_locked := true;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_items_lock_def on public.shop_items;
create trigger shop_items_lock_def
  before insert or update on public.shop_items
  for each row execute function public.lock_shop_item_def();
