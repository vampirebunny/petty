-- Shop catalog rows. `supabase/migrations/20261023170000_shop_catalog_rows.sql` inserted them;
-- later migrations rename rows. This file is the current copy the closet-name test reads.
-- Safe to run again. A change bumps shop_config.version through the existing trigger.

insert into public.shop_config (id, pick_slots, no_repeat_days, deal_pct, version)
values (1, '["clothes","toys","treats_or_boosts"]'::jsonb, 5, 20, 1)
on conflict (id) do update set
  pick_slots = excluded.pick_slots,
  no_repeat_days = excluded.no_repeat_days,
  deal_pct = excluded.deal_pct;

insert into public.shop_items (id, name, category, price, shop, species, description, sort, active, tier, cap) values
  ('neckwear:bandana-cherry', 'Cherry Bandana', 'clothes', 500, 'always', null, null, 0, true, 'standard', null),
  ('neckwear:bell', 'Brown Bell Collar', 'clothes', 600, 'always', null, null, 1, true, 'standard', null),
  ('neckwear:bow', 'Pink Bow', 'clothes', 600, 'rotation', null, null, 2, true, 'standard', null),
  ('neckwear:scarf-stripe', 'Candy Stripe Scarf', 'clothes', 700, 'always', null, null, 3, true, 'standard', null),
  ('neckwear:bandana-gingham', 'Red Gingham Bandana', 'clothes', 700, 'rotation', null, null, 4, true, 'standard', null),
  ('neckwear:bowtie', 'Navy Bow Tie', 'clothes', 800, 'always', null, null, 5, true, 'standard', null),
  ('neckwear:gold', 'Gold Stud Collar', 'clothes', 900, 'rotation', null, null, 6, true, 'standard', null),
  ('neckwear:bowtie-plaid', 'Red Plaid Bow Tie', 'clothes', 900, 'rotation', null, null, 7, true, 'standard', null),
  ('glasses:classic', 'Black Shades', 'clothes', 800, 'always', null, null, 8, true, 'standard', null),
  ('glasses:square', 'Round Gold Specs', 'clothes', 800, 'rotation', null, null, 9, true, 'standard', null),
  ('glasses:heart', 'Pink Heart Shades', 'clothes', 1000, 'always', null, null, 10, true, 'standard', null),
  ('glasses:heart-sky', 'Sky Heart Shades', 'clothes', 1000, 'rotation', null, null, 11, true, 'standard', null),
  ('hat:beanie-pink', 'Pink Beanie', 'clothes', 900, 'always', null, null, 12, true, 'standard', null),
  ('hat:beanie-stripe', 'Navy Stripe Beanie', 'clothes', 1000, 'rotation', null, null, 13, true, 'standard', null),
  ('hat:cap', 'Red Ball Cap', 'clothes', 1000, 'always', null, null, 14, true, 'standard', null),
  ('hat:cap-sky', 'Sky Ball Cap', 'clothes', 1000, 'rotation', null, null, 15, true, 'standard', null),
  ('hat:bucket', 'Sunny Bucket Hat', 'clothes', 1100, 'always', null, null, 16, true, 'standard', null),
  ('hat:party', 'Party Hat', 'clothes', 1200, 'always', null, null, 17, true, 'standard', null),
  ('hat:beret', 'Rose Beret', 'clothes', 1200, 'rotation', null, null, 18, true, 'standard', null),
  ('hat:bucket-daisy', 'Daisy Bucket Hat', 'clothes', 1300, 'rotation', null, null, 19, true, 'standard', null),
  ('hat:top', 'Black Top Hat', 'clothes', 1500, 'rotation', null, null, 20, true, 'standard', null),
  ('boots:rain', 'Yellow Rain Boots', 'clothes', 1600, 'always', null, null, 21, true, 'standard', null),
  ('boots:sneaker', 'White Sneakers', 'clothes', 1600, 'always', null, null, 22, true, 'standard', null),
  ('boots:rain-blue', 'Puddle Blue Boots', 'clothes', 1600, 'rotation', null, null, 23, true, 'standard', null),
  ('boots:sneaker-pink', 'Bubblegum Sneakers', 'clothes', 1700, 'rotation', null, null, 24, true, 'standard', null),
  ('jacket:sweater', 'Cherry Sweater', 'clothes', 2400, 'always', null, null, 25, true, 'standard', null),
  ('jacket:vest', 'Blue Quilted Vest', 'clothes', 2400, 'always', null, null, 26, true, 'standard', null),
  ('jacket:puffer-mint', 'Mint Puffer', 'clothes', 2400, 'rotation', null, null, 27, true, 'standard', null),
  ('jacket:sweater-lilac', 'Lilac Sweater', 'clothes', 2400, 'rotation', null, null, 28, true, 'standard', null),
  ('jacket:hoodie', 'Cozy Pink Hoodie', 'clothes', 2600, 'always', null, null, 29, true, 'standard', null),
  ('jacket:rain', 'Yellow Raincoat', 'clothes', 2800, 'always', null, null, 30, true, 'standard', null),
  ('glasses:star', 'Gold Star Shades', 'clothes', 3000, 'rotation', null, null, 31, true, 'exclusive', null),
  ('hat:top-velvet', 'Midnight Top Hat', 'clothes', 3500, 'rotation', null, null, 32, true, 'exclusive', null),
  ('boots:sneaker-gold', 'Gold High-Tops', 'clothes', 3800, 'rotation', null, null, 33, true, 'exclusive', null),
  ('jacket:puffer-rainbow', 'Rainbow Puffer', 'clothes', 4500, 'rotation', null, null, 34, true, 'exclusive', null),
  ('hat:crown', 'Golden Crown', 'clothes', 7500, 'featured', null, null, 35, true, 'limited', 500),
  ('squeaky', 'Squeaky Duckie', 'toys', 800, 'always', array['dog'], null, 0, true, 'standard', null),
  ('bone', 'Mint Chew Bone', 'toys', 900, 'rotation', array['dog'], null, 1, true, 'standard', null),
  ('rope', 'Red Rope Tug', 'toys', 1000, 'hidden', array['dog'], null, 2, true, 'standard', null),
  ('frisbee', 'Blue Frisbee', 'toys', 1200, 'always', array['dog'], null, 3, true, 'standard', null),
  ('crinkle', 'Blue Crinkle Ball', 'toys', 700, 'rotation', array['cat'], null, 4, true, 'standard', null),
  ('yarn', 'Pink Yarn Ball', 'toys', 800, 'always', array['cat'], null, 5, true, 'standard', null),
  ('mouse', 'Lilac Catnip Mouse', 'toys', 800, 'always', array['cat'], null, 6, true, 'standard', null),
  ('wand', 'Feather Wand', 'toys', 1400, 'always', array['cat'], null, 7, true, 'standard', null),
  ('laser', 'Purple Laser Pointer', 'toys', 2000, 'rotation', array['cat'], null, 8, true, 'standard', null),
  ('dogHouse', 'Pup Cabana', 'home', 6000, 'always', array['dog'], '2× faster rest', 22, true, 'standard', null),
  ('bowl_food', 'Extra food bowl', 'home', 600, 'always', null, null, 10, true, 'standard', null),
  ('bowl_water', 'Extra water bowl', 'home', 600, 'always', null, null, 11, true, 'standard', null),
  ('bed_standard', 'Standard Bed', 'home', 2500, 'always', null, null, 20, true, 'standard', null),
  ('bed_cloud_puff', 'Marshmallow Mat', 'home', 4500, 'always', array['dog'], '2× faster rest', 21, true, 'standard', null),
  ('bed_bone_sofa', 'Peach Chaise', 'home', 6500, 'always', array['dog'], '2.5× faster rest', 22, true, 'standard', null),
  ('bed_kitty_cave', 'Cushion Stack', 'home', 4500, 'always', array['cat'], '2× faster rest', 23, true, 'standard', null),
  ('bed_moon_cradle', 'Sultan Pillow', 'home', 6500, 'always', array['cat'], '2.5× faster rest', 24, true, 'standard', null),
  ('catTree', 'Cat Tree', 'home', 8000, 'always', array['cat'], null, 1, true, 'standard', null),
  ('scratcher', 'Scratch Pole', 'home', 4000, 'always', array['cat'], null, 2, true, 'standard', null),
  ('biscuit', 'Biscuit', 'treats', 15, 'always', null, null, 0, true, 'standard', null),
  ('special', 'Salmon Bites', 'treats', 40, 'always', null, null, 1, true, 'standard', null),
  ('treat_jerky', 'Chicken Jerky', 'treats', 80, 'always', array['dog'], null, 2, true, 'standard', null),
  ('treat_tuna', 'Tuna Flakes', 'treats', 80, 'always', array['cat'], null, 3, true, 'standard', null),
  ('food_gourmet', 'Gourmet Bowl', 'treats', 60, 'always', null, 'A full tummy, and a healthier diet. Fed for a few days, older pets look and move younger.', 4, true, 'standard', null),
  ('food_steak', 'Steak Dinner', 'treats', 60, 'always', array['dog'], 'A full tummy, and a healthier diet. Fed for a few days, older pets look and move younger.', 5, true, 'standard', null),
  ('food_fish', 'Fish Feast', 'treats', 60, 'always', array['cat'], 'A full tummy, and a healthier diet. Fed for a few days, older pets look and move younger.', 6, true, 'standard', null),
  ('second_wind', 'Second Wind', 'boosts', 150, 'always', null, 'Ends a trick''s rest early', 0, true, 'standard', null),
  ('vitamins', 'Vitamins', 'boosts', null, 'coming_soon', null, 'Coming soon', 1, true, 'standard', null)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  shop = excluded.shop,
  species = excluded.species,
  description = excluded.description,
  sort = excluded.sort,
  active = excluded.active,
  tier = excluded.tier,
  cap = excluded.cap;

insert into public.shop_bundles (id, name, price, contents, description, sort, active) values
  ('treat_bag', 'Treat Bag ×10', 120, '[{"itemId":"biscuit","qty":10}]'::jsonb, 'Ten biscuits, bundled', 0, true),
  ('treat_tin', 'Treat Tin ×25', 280, '[{"itemId":"biscuit","qty":25}]'::jsonb, 'Twenty-five biscuits, bundled', 1, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  contents = excluded.contents,
  description = excluded.description,
  sort = excluded.sort,
  active = excluded.active;

insert into public.limited_editions (item_id, cap)
values ('hat:crown', 500)
on conflict (item_id) do update set
  cap = excluded.cap;
