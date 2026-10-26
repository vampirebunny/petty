-- Pup Cabana replaces the Glass Conservatory. Same item, open front, 2× rest.
update public.shop_items
set
  name = 'Pup Cabana',
  description = '2× faster rest',
  price = 6000,
  sort = 22
where id = 'dogHouse';
