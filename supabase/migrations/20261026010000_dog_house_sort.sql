-- Glass Conservatory is the priciest furniture, so it sits last on the shelf.
-- The statement trigger bumps shop_config.version.

update public.shop_items set sort = 25 where id = 'dogHouse';
