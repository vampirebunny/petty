-- Scratch pole leaves the catio scenery and joins the furniture shelf.

insert into public.shop_items (id, name, category, price, shop, species, description, sort, active, tier, cap) values
  ('scratcher', 'Scratch Pole', 'home', 2500, 'always', array['cat'], null, 2, true, 'standard', null)
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
