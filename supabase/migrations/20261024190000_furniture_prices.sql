-- Scratch pole 4000, cat tree 8000. The statement trigger bumps shop_config.version.

update public.shop_items set price = 4000 where id = 'scratcher';
update public.shop_items set price = 8000 where id = 'catTree';
