-- Cozy hoodie, sold like the sweater and vest. Price is a placeholder until the catalog work.

insert into public.shop_items (id, name, category, price, shop, species, description, sort)
values ('jacket:hoodie', 'Hoodie', 'clothes', 1600, 'always', null, null, 12)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  shop = excluded.shop,
  species = excluded.species,
  description = excluded.description,
  sort = excluded.sort;
