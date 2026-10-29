-- Second Wind costs 500 Boops. The statement trigger bumps shop_config.version.

update public.shop_items set price = 500 where id = 'second_wind';
