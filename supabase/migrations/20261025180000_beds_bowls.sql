-- Dog house, bowls, and beds. The statement trigger bumps shop_config.version.

update public.shop_items set price = 8000 where id = 'dogHouse';

insert into public.shop_items (id, name, category, price, shop, species, description, sort, active, tier, cap) values
  ('bowl_food', 'Extra food bowl', 'home', 600, 'always', null, null, 10, true, 'standard', null),
  ('bowl_water', 'Extra water bowl', 'home', 600, 'always', null, null, 11, true, 'standard', null),
  ('bed_standard', 'Standard Bed', 'home', 2500, 'always', null, null, 20, true, 'standard', null),
  ('bed_cloud_puff', 'Cloud Puff Bolster', 'home', 4500, 'always', array['dog'], '2× faster rest', 21, true, 'standard', null),
  ('bed_bone_sofa', 'Bone Pillow Sofa', 'home', 6500, 'always', array['dog'], '2.5× faster rest', 22, true, 'standard', null),
  ('bed_kitty_cave', 'Kitty Cave Pod', 'home', 4500, 'always', array['cat'], '2× faster rest', 23, true, 'standard', null),
  ('bed_moon_cradle', 'Moon Cradle', 'home', 6500, 'always', array['cat'], '2.5× faster rest', 24, true, 'standard', null)
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
