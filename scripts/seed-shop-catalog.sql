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
  ('neckwear:bandana-cherry', 'Cherry Bandana', 'clothes', null, 'hidden', null, null, 20, true),
  ('neckwear:scarf-stripe', 'Candy Stripe Scarf', 'clothes', null, 'hidden', null, null, 21, true),
  ('neckwear:bandana-gingham', 'Picnic Bandana', 'clothes', null, 'hidden', null, null, 22, true),
  ('neckwear:bowtie', 'Navy Bow Tie', 'clothes', null, 'hidden', null, null, 23, true),
  ('neckwear:bowtie-plaid', 'Plaid Bow Tie', 'clothes', null, 'hidden', null, null, 24, true),
  ('glasses:heart', 'Heart Shades', 'clothes', null, 'hidden', null, null, 25, true),
  ('glasses:heart-sky', 'Sky Heart Shades', 'clothes', null, 'hidden', null, null, 26, true),
  ('glasses:star', 'Star Shades', 'clothes', null, 'hidden', null, null, 27, true),
  ('hat:beanie-pink', 'Pink Beanie', 'clothes', null, 'hidden', null, null, 28, true),
  ('hat:beanie-stripe', 'Stripe Beanie', 'clothes', null, 'hidden', null, null, 29, true),
  ('hat:cap', 'Red Ball Cap', 'clothes', null, 'hidden', null, null, 30, true),
  ('hat:cap-sky', 'Sky Ball Cap', 'clothes', null, 'hidden', null, null, 31, true),
  ('hat:bucket', 'Sunny Bucket Hat', 'clothes', null, 'hidden', null, null, 32, true),
  ('hat:bucket-daisy', 'Daisy Bucket Hat', 'clothes', null, 'hidden', null, null, 33, true),
  ('hat:beret', 'Rose Beret', 'clothes', null, 'hidden', null, null, 34, true),
  ('hat:top-velvet', 'Midnight Top Hat', 'clothes', null, 'hidden', null, null, 35, true),
  ('hat:crown', 'Golden Crown', 'clothes', null, 'hidden', null, null, 36, true),
  ('boots:rain-blue', 'Puddle Blue Boots', 'clothes', null, 'hidden', null, null, 37, true),
  ('boots:sneaker-pink', 'Bubblegum Sneakers', 'clothes', null, 'hidden', null, null, 38, true),
  ('boots:sneaker-gold', 'Gold High-Tops', 'clothes', null, 'hidden', null, null, 39, true),
  ('jacket:puffer-mint', 'Mint Puffer', 'clothes', null, 'hidden', null, null, 40, true),
  ('jacket:sweater-lilac', 'Lilac Sweater', 'clothes', null, 'hidden', null, null, 41, true),
  ('jacket:puffer-rainbow', 'Rainbow Puffer', 'clothes', null, 'hidden', null, null, 42, true),
  ('crinkle', 'Crinkle Ball', 'toys', null, 'hidden', array['cat'], null, 10, true),
  ('mouse', 'Mouse', 'toys', null, 'hidden', array['cat'], null, 11, true),
  ('bone', 'Chewy Bone', 'toys', null, 'hidden', array['dog'], null, 12, true),
  ('rope', 'Rope', 'toys', null, 'hidden', null, null, 13, true),
  ('wand', 'Feather Wand', 'toys', null, 'hidden', array['cat'], null, 14, true),
  ('laser', 'Laser', 'toys', null, 'hidden', array['cat'], null, 15, true),
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
