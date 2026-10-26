-- October 2026 price list. The Golden Crown stays featured and hidden in the client.
-- One statement so shop_config.version bumps once.

update public.shop_items
set price = case id
  when 'glasses:classic' then 900
  when 'glasses:square' then 900
  when 'glasses:heart' then 1200
  when 'glasses:heart-sky' then 1200
  when 'hat:beanie-pink' then 1100
  when 'hat:beanie-stripe' then 1200
  when 'hat:cap' then 1200
  when 'hat:cap-sky' then 1200
  when 'hat:bucket' then 1300
  when 'hat:party' then 1400
  when 'hat:beret' then 1500
  when 'hat:bucket-daisy' then 1600
  when 'hat:top' then 1800
  when 'boots:rain' then 2000
  when 'boots:sneaker' then 2000
  when 'boots:rain-blue' then 2000
  when 'boots:sneaker-pink' then 2100
  when 'jacket:sweater' then 3000
  when 'jacket:vest' then 3000
  when 'jacket:puffer-mint' then 3000
  when 'jacket:sweater-lilac' then 3000
  when 'jacket:hoodie' then 3200
  when 'jacket:rain' then 3500
  when 'glasses:star' then 4000
  when 'hat:top-velvet' then 4500
  when 'boots:sneaker-gold' then 5000
  when 'jacket:puffer-rainbow' then 6000
  when 'hat:crown' then 20000
  when 'squeaky' then 900
  when 'bone' then 1000
  when 'rope' then 1200
  when 'frisbee' then 1500
  when 'crinkle' then 800
  when 'yarn' then 900
  when 'mouse' then 900
  when 'wand' then 1700
  when 'laser' then 2500
  when 'dogHouse' then 9000
  when 'bowl_food' then 700
  when 'bowl_water' then 700
  when 'bed_standard' then 3000
  when 'bed_cloud_puff' then 5500
  when 'bed_bone_sofa' then 8000
  when 'bed_kitty_cave' then 5500
  when 'bed_moon_cradle' then 8000
  when 'catTree' then 10000
  when 'scratcher' then 5000
  when 'special' then 200
  when 'treat_jerky' then 250
  when 'treat_tuna' then 250
  when 'food_gourmet' then 300
  when 'food_steak' then 300
  when 'food_fish' then 300
  else price
end
where id in (
  'glasses:classic', 'glasses:square', 'glasses:heart', 'glasses:heart-sky',
  'hat:beanie-pink', 'hat:beanie-stripe', 'hat:cap', 'hat:cap-sky', 'hat:bucket', 'hat:party',
  'hat:beret', 'hat:bucket-daisy', 'hat:top',
  'boots:rain', 'boots:sneaker', 'boots:rain-blue', 'boots:sneaker-pink',
  'jacket:sweater', 'jacket:vest', 'jacket:puffer-mint', 'jacket:sweater-lilac', 'jacket:hoodie', 'jacket:rain',
  'glasses:star', 'hat:top-velvet', 'boots:sneaker-gold', 'jacket:puffer-rainbow', 'hat:crown',
  'squeaky', 'bone', 'rope', 'frisbee', 'crinkle', 'yarn', 'mouse', 'wand', 'laser',
  'dogHouse', 'bowl_food', 'bowl_water', 'bed_standard', 'bed_cloud_puff', 'bed_bone_sofa',
  'bed_kitty_cave', 'bed_moon_cradle', 'catTree', 'scratcher',
  'special', 'treat_jerky', 'treat_tuna', 'food_gourmet', 'food_steak', 'food_fish'
);
