-- Re-seed the placeholder shop catalog. Safe to run again.
-- Applies prices and the rotation split. A change bumps shop_config.version.
-- The project owner runs this in the Supabase SQL editor. Do not run it from an agent.

insert into public.shop_config (id, pick_slots, no_repeat_days, deal_pct, version)
values (1, '["clothes","toys","treats_or_boosts"]'::jsonb, 5, 20, 1)
on conflict (id) do update set
  pick_slots = excluded.pick_slots,
  no_repeat_days = excluded.no_repeat_days,
  deal_pct = excluded.deal_pct;

insert into public.shop_items (id, name, category, price, shop, species, description, sort, active) values
  ('biscuit', 'Treats', 'treats', 30, 'always', null, 'Basic treat', 0, true),
  ('special', 'Special treat', 'treats', 60, 'always', null, 'A rich casual treat', 1, true),
  ('food_gourmet', 'Gourmet', 'treats', 50, 'always', null, 'A rich meal', 2, true),
  ('food_fish', 'Fish', 'treats', null, 'hidden', null, null, 9, true),
  ('neckwear:bell', 'Bell', 'clothes', 500, 'always', null, null, 0, true),
  ('glasses:classic', 'Classic shades', 'clothes', 700, 'always', null, null, 1, true),
  ('hat:party', 'Party hat', 'clothes', 1000, 'always', null, null, 2, true),
  ('boots:rain', 'Rain boots', 'clothes', 1200, 'always', null, null, 3, true),
  ('jacket:sweater', 'Knit sweater', 'clothes', 1600, 'always', null, null, 4, true),
  ('jacket:vest', 'Quilted vest', 'clothes', 1600, 'always', null, null, 5, true),
  ('neckwear:bow', 'Bow', 'clothes', 500, 'rotation', null, null, 6, true),
  ('neckwear:gold', 'Gold collar', 'clothes', 500, 'rotation', null, null, 7, true),
  ('glasses:square', 'Square gold', 'clothes', 700, 'rotation', null, null, 8, true),
  ('hat:top', 'Top hat', 'clothes', 1000, 'rotation', null, null, 9, true),
  ('boots:sneaker', 'Sneakers', 'clothes', 1200, 'rotation', null, null, 10, true),
  ('jacket:rain', 'Raincoat', 'clothes', 1600, 'rotation', null, null, 11, true),
  ('jacket:hoodie', 'Hoodie', 'clothes', 1600, 'always', null, null, 12, true),
  ('frisbee', 'Frisbee', 'toys', 400, 'always', array['dog'], 'A disc to chase', 0, true),
  ('squeaky', 'Squeaky', 'toys', 300, 'rotation', array['dog'], 'A toy that squeaks', 1, true),
  ('yarn', 'Yarn', 'toys', 300, 'rotation', array['cat'], 'A ball of yarn', 2, true),
  ('second_wind', 'Second Wind', 'boosts', 120, 'always', null, 'Ends a trick''s rest early', 0, true),
  ('vitamins', 'Vitamins', 'boosts', null, 'coming_soon', null, 'Coming soon', 1, true)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  shop = excluded.shop,
  species = excluded.species,
  description = excluded.description,
  sort = excluded.sort,
  active = excluded.active;

insert into public.shop_bundles (id, name, price, contents, description, sort, active)
values (
  'treat_bag',
  'Treat Bag ×10',
  240,
  '[{"itemId":"biscuit","qty":10}]'::jsonb,
  'Ten biscuits, bundled',
  0,
  true
)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  contents = excluded.contents,
  description = excluded.description,
  sort = excluded.sort,
  active = excluded.active;
