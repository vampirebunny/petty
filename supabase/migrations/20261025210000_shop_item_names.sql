-- Name the color or pattern on items that will gain variants.
-- A statement trigger bumps shop_config.version when these rows change.

update public.shop_items set name = 'Brown Bell Collar' where id = 'neckwear:bell';
update public.shop_items set name = 'Red Gingham Bandana' where id = 'neckwear:bandana-gingham';
update public.shop_items set name = 'Red Plaid Bow Tie' where id = 'neckwear:bowtie-plaid';
update public.shop_items set name = 'Black Shades' where id = 'glasses:classic';
update public.shop_items set name = 'Pink Heart Shades' where id = 'glasses:heart';
update public.shop_items set name = 'Navy Stripe Beanie' where id = 'hat:beanie-stripe';
update public.shop_items set name = 'Black Top Hat' where id = 'hat:top';
update public.shop_items set name = 'White Sneakers' where id = 'boots:sneaker';
update public.shop_items set name = 'Blue Quilted Vest' where id = 'jacket:vest';
update public.shop_items set name = 'Cozy Pink Hoodie' where id = 'jacket:hoodie';
update public.shop_items set name = 'Gold Star Shades' where id = 'glasses:star';
update public.shop_items set name = 'Squeaky Duckie' where id = 'squeaky';
update public.shop_items set name = 'Mint Chew Bone' where id = 'bone';
update public.shop_items set name = 'Red Rope Tug' where id = 'rope';
update public.shop_items set name = 'Blue Frisbee' where id = 'frisbee';
update public.shop_items set name = 'Blue Crinkle Ball' where id = 'crinkle';
update public.shop_items set name = 'Pink Yarn Ball' where id = 'yarn';
update public.shop_items set name = 'Lilac Catnip Mouse' where id = 'mouse';
update public.shop_items set name = 'Purple Laser Pointer' where id = 'laser';
