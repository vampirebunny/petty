-- Colorway rows were priced by rarity. Charge the same Boops as the hand-made
-- item of that shape. Rarity still chooses the shelf.
-- Gold Star Shades join the other shades at 900. Gold High-Tops join the sneakers at 2000.

update public.shop_items
set price = case
  when id = 'glasses:star' then 900
  when id = 'boots:sneaker-gold' then 2000
  when def->>'shape' = 'beanie' then 1100
  when def->>'shape' = 'party' then 1400
  when def->>'shape' = 'top' then 1800
  when def->>'shape' = 'cap' then 1200
  when def->>'shape' = 'bucket' then 1300
  when def->>'shape' = 'beret' then 1500
  when def->>'shape' = 'square' then 900
  when def->>'shape' = 'red-rim' then 900
  when def->>'shape' = 'heart' then 1200
  when def->>'shape' = 'star' then 900
  when def->>'shape' = 'collar' then 600
  when def->>'shape' = 'bandana' then 500
  when def->>'shape' = 'scarf' then 700
  when def->>'shape' = 'bow' then 600
  when def->>'shape' = 'bowtie' then 800
  when def->>'shape' = 'sweater' then 3000
  when def->>'shape' = 'hoodie' then 3200
  when def->>'shape' = 'puffer' then 3000
  when def->>'shape' = 'vest' then 3000
  when def->>'shape' = 'raincoat' then 3500
  when def->>'shape' = 'red' then 2000
  when def->>'shape' = 'rain' then 2000
  when def->>'shape' = 'sneaker' then 2000
  when def->>'shape' = 'hightop' then 2000
  else price
end
where rarity is not null
   or id in ('glasses:star', 'boots:sneaker-gold');
