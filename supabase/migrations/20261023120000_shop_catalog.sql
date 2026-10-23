-- Shop catalog. Read-only for clients. Placeholder prices; the owner edits them in the dashboard.
-- Not applied yet. The project owner applies this with `supabase db push`.

create table public.shop_config (
  id int primary key default 1 check (id = 1),
  pick_slots jsonb not null,
  no_repeat_days int not null,
  deal_pct int not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table public.shop_items (
  id text primary key,
  name text not null,
  category text not null check (category in ('treats', 'clothes', 'toys', 'boosts')),
  price int,
  shop text not null check (shop in ('always', 'rotation', 'coming_soon', 'hidden')),
  species text[],
  is_new_until date,
  description text,
  sort int not null default 0,
  active boolean not null default true
);

create table public.shop_bundles (
  id text primary key,
  name text not null,
  price int not null,
  contents jsonb not null,
  description text,
  sort int not null default 0,
  active boolean not null default true
);

create or replace function public.bump_shop_catalog_version()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'shop_config' then
    if tg_op = 'UPDATE' and new.version is not distinct from old.version then
      new.version := old.version + 1;
    end if;
    new.updated_at := now();
    return new;
  end if;
  update public.shop_config
    set version = version + 1
    where id = 1;
  return null;
end;
$$;

create trigger shop_config_bump
  before update on public.shop_config
  for each row execute function public.bump_shop_catalog_version();

create trigger shop_items_bump
  after insert or update or delete on public.shop_items
  for each statement execute function public.bump_shop_catalog_version();

create trigger shop_bundles_bump
  after insert or update or delete on public.shop_bundles
  for each statement execute function public.bump_shop_catalog_version();

alter table public.shop_config enable row level security;
alter table public.shop_items enable row level security;
alter table public.shop_bundles enable row level security;

revoke all on public.shop_config, public.shop_items, public.shop_bundles from anon, authenticated;
grant select on public.shop_config, public.shop_items, public.shop_bundles to anon, authenticated;

create policy shop_config_read on public.shop_config for select to anon, authenticated using (true);
create policy shop_items_read on public.shop_items for select to anon, authenticated using (true);
create policy shop_bundles_read on public.shop_bundles for select to anon, authenticated using (true);

insert into public.shop_config (id, pick_slots, no_repeat_days, deal_pct, version)
values (1, '["clothes","toys","treats_or_boosts"]'::jsonb, 5, 20, 1);

insert into public.shop_items (id, name, category, price, shop, species, description, sort) values
  ('biscuit', 'Treats', 'treats', 30, 'always', null, 'Basic treat', 0),
  ('special', 'Special treat', 'treats', 60, 'always', null, 'A rich casual treat', 1),
  ('food_gourmet', 'Gourmet', 'treats', 50, 'always', null, 'A rich meal', 2),
  ('food_fish', 'Fish', 'treats', null, 'hidden', null, null, 9),
  ('neckwear:bell', 'Bell', 'clothes', 500, 'always', null, null, 0),
  ('glasses:classic', 'Classic shades', 'clothes', 700, 'always', null, null, 1),
  ('hat:party', 'Party hat', 'clothes', 1000, 'always', null, null, 2),
  ('boots:rain', 'Rain boots', 'clothes', 1200, 'always', null, null, 3),
  ('jacket:sweater', 'Knit sweater', 'clothes', 1600, 'always', null, null, 4),
  ('jacket:vest', 'Quilted vest', 'clothes', 1600, 'always', null, null, 5),
  ('neckwear:bow', 'Bow', 'clothes', 500, 'rotation', null, null, 6),
  ('neckwear:gold', 'Gold collar', 'clothes', 500, 'rotation', null, null, 7),
  ('glasses:square', 'Square gold', 'clothes', 700, 'rotation', null, null, 8),
  ('hat:top', 'Top hat', 'clothes', 1000, 'rotation', null, null, 9),
  ('boots:sneaker', 'Sneakers', 'clothes', 1200, 'rotation', null, null, 10),
  ('jacket:rain', 'Raincoat', 'clothes', 1600, 'rotation', null, null, 11),
  ('frisbee', 'Frisbee', 'toys', 400, 'always', array['dog'], 'A disc to chase', 0),
  ('squeaky', 'Squeaky', 'toys', 300, 'rotation', array['dog'], 'A toy that squeaks', 1),
  ('yarn', 'Yarn', 'toys', 300, 'rotation', array['cat'], 'A ball of yarn', 2),
  ('second_wind', 'Second Wind', 'boosts', 120, 'always', null, 'Ends a trick''s rest early', 0),
  ('vitamins', 'Vitamins', 'boosts', null, 'coming_soon', null, 'Coming soon', 1);

insert into public.shop_bundles (id, name, price, contents, description, sort)
values (
  'treat_bag',
  'Treat Bag ×10',
  240,
  '[{"itemId":"biscuit","qty":10}]'::jsonb,
  'Ten biscuits, bundled',
  0
);
