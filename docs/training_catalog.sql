-- =====================================================================
-- Boop Boop — Training catalog (tricks + training furniture)
-- Pairs with: Cursor Brief — Training School, Furniture Tricks & Storage (v2)
--
-- All prices, difficulties and attribute points are PLACEHOLDERS.
-- Tune them here; the app reads everything from the catalog.
--
-- NOTE FOR CURSOR
--  * `catalog_items` below = the existing Pet Shop catalog table. If it has a
--    different name or column names, adapt the ALTER/INSERT to match.
--  * `min_age_stage` uses species-neutral keys. Map them to the life-stage
--    enum already in the code:
--        baby       = puppy / kitten
--        young      = older puppy / older kitten
--        adolescent = adolescent
--        adult      = adult
--  * Attribute keys must match the existing ones:
--        stamina, agility, intelligence, boldness, affection, obedience
--  * Starter tricks (sit/speak/paw) already exist in the app. If their
--    attribute gains are already defined in code, keep those and update
--    these rows to match rather than the other way round.
--  * Every non-starter trick ships with is_active = false. Flip it to true
--    only once BOTH its pet animation and its demo animation are in the
--    installed app (see the brief's "only show tricks the app can perform").
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Training furniture on the Pet Shop catalog
-- ---------------------------------------------------------------------
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS furniture_type text,          -- tunnel, podium, hurdle, cones, stool, hoop, food_bowl, ...
  ADD COLUMN IF NOT EXISTS is_prop        boolean NOT NULL DEFAULT false,  -- can be held / moved / put away / used by tricks
  ADD COLUMN IF NOT EXISTS place_target   boolean NOT NULL DEFAULT false,  -- valid target for the Place trick
  ADD COLUMN IF NOT EXISTS is_essential   boolean NOT NULL DEFAULT false,  -- warn on Put away (bowls, bed)
  ADD COLUMN IF NOT EXISTS anchors        jsonb;                           -- interaction points for trick animations

-- Anchors are in scene units, relative to the item's origin = bottom-centre
-- of its footprint (where it touches the floor). x right, y up is NEGATIVE
-- (screen coords). Scale with the item. Values match the Training School art.
--
-- These default items are granted by trick bundles only. They are not sold
-- on their own yet (is_sellable = false); variants in other sizes/colours
-- come later and must carry their own anchors.
-- species = NULL means both dogs and cats use it. Furniture belongs to the
-- player, so a cat can train Place on the podium a dog's bundle brought in.
-- The two tunnels are the same item in two colours: a dog's bundle grants
-- the pink one and a cat's bundle the blue one; either works for either pet.

INSERT INTO catalog_items
  (id, name, category, species, price_boops, is_sellable, collection,
   furniture_type, is_prop, place_target, is_essential, anchors)
VALUES
  ('furn_podium_classic', 'Podium',   'furniture', NULL,  NULL, false, 'evergreen',
   'podium', true, true,  false,
   '{"top_left":{"x":-40,"y":-30},"top_right":{"x":40,"y":-30},"footprint":{"w":80,"h":20}}'),

  ('furn_tunnel_pink',    'Tunnel',   'furniture', NULL,  NULL, false, 'evergreen',
   'tunnel', true, false, false,
   '{"entry":{"x":-66,"y":-32},"exit":{"x":66,"y":-32},"inner_height":50,"footprint":{"w":132,"h":16}}'),

  ('furn_tunnel_blue',    'Tunnel',   'furniture', NULL,  NULL, false, 'evergreen',
   'tunnel', true, false, false,
   '{"entry":{"x":-66,"y":-32},"exit":{"x":66,"y":-32},"inner_height":50,"footprint":{"w":132,"h":16}}'),

  ('furn_hurdle_classic', 'Hurdle',   'furniture', NULL,  NULL, false, 'evergreen',
   'hurdle', true, false, false,
   '{"bar_height":48,"left_x":-30,"right_x":30,"approach":{"x":-80,"y":0},"landing":{"x":80,"y":0},"footprint":{"w":86,"h":12}}'),

  ('furn_cones_set',      'Cone Set', 'furniture', NULL,  NULL, false, 'evergreen',
   'cones',  true, false, false,
   '{"path":[{"x":-60,"y":0},{"x":-20,"y":0},{"x":20,"y":0},{"x":60,"y":0}],"footprint":{"w":150,"h":16}}'),

  ('furn_stool_classic',  'Stool',    'furniture', NULL,  NULL, false, 'evergreen',
   'stool',  true, true,  false,
   '{"top_left":{"x":-40,"y":-30},"top_right":{"x":40,"y":-30},"footprint":{"w":80,"h":20}}'),

  ('furn_hoop_classic',   'Hoop',     'furniture', NULL,  NULL, false, 'evergreen',
   'hoop',   true, false, false,
   '{"center":{"x":0,"y":-70},"radius":30,"approach":{"x":-80,"y":0},"landing":{"x":80,"y":0},"footprint":{"w":60,"h":12}}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, furniture_type = EXCLUDED.furniture_type,
  is_prop = EXCLUDED.is_prop, place_target = EXCLUDED.place_target,
  is_essential = EXCLUDED.is_essential, anchors = EXCLUDED.anchors;

-- Existing essentials become props too (hold → Move / Put away, with warning).
-- Adjust the ids to the real ones.
UPDATE catalog_items SET furniture_type = 'food_bowl',  is_prop = true, is_essential = true WHERE id = 'food_bowl_default';
UPDATE catalog_items SET furniture_type = 'water_bowl', is_prop = true, is_essential = true WHERE id = 'water_bowl_default';
UPDATE catalog_items SET furniture_type = 'pet_bed',    is_prop = true, is_essential = true WHERE id = 'pet_bed_default';


-- ---------------------------------------------------------------------
-- 2. Trick catalog
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_tricks (
  id                        text PRIMARY KEY,                 -- e.g. dog_roll_over
  species                   text NOT NULL CHECK (species IN ('dog','cat')),
  name                      text NOT NULL,
  description               text NOT NULL,                    -- one line, shown in the preview
  is_starter                boolean NOT NULL DEFAULT false,   -- every pet starts with it; never in the shop
  price_boops               int     NOT NULL DEFAULT 0,       -- trick-only price
  required_furniture_type   text,                             -- null = plain trick
  bundle_price_boops        int,                              -- trick + default furniture (player owns none of that type)
  bundle_item_id            text REFERENCES catalog_items(id),-- furniture granted with the bundle
  min_age_stage             text NOT NULL CHECK (min_age_stage IN ('baby','young','adolescent','adult')),
  difficulty                numeric(3,2) NOT NULL DEFAULT 1.0,-- learning-rate multiplier (higher = slower)
  attributes_raised         jsonb   NOT NULL,                 -- points per successful rep, existing attribute keys
  pet_animation_key         text    NOT NULL,                 -- procedural animation the pet performs
  demo_animation_key        text    NOT NULL,                 -- generic preview demo
  icon_key                  text    NOT NULL,                 -- shop card / practice button icon
  collection                text    NOT NULL DEFAULT 'evergreen',
  edition                   text,                             -- reserved: limited / exclusive (null for now)
  sort_order                int     NOT NULL,
  is_active                 boolean NOT NULL DEFAULT false,
  CHECK ( (required_furniture_type IS NULL AND bundle_price_boops IS NULL AND bundle_item_id IS NULL)
       OR (required_furniture_type IS NOT NULL AND bundle_price_boops IS NOT NULL AND bundle_item_id IS NOT NULL) )
);

INSERT INTO catalog_tricks
  (id, species, name, description, is_starter, price_boops,
   required_furniture_type, bundle_price_boops, bundle_item_id,
   min_age_stage, difficulty, attributes_raised,
   pet_animation_key, demo_animation_key, icon_key, sort_order, is_active)
VALUES
-- ===================== DOGS =====================
-- Starters
  ('dog_sit',   'dog', 'Sit',   'Plops that bottom right down and looks up at you.', true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"obedience":2}',
   'dog.sit', 'demo.dog.sit', 'icon.sit', 10, true),
  ('dog_speak', 'dog', 'Speak', 'One proud little woof, right on cue.',              true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"boldness":1,"obedience":1}',
   'dog.speak', 'demo.dog.speak', 'icon.speak', 20, true),
  ('dog_paw',   'dog', 'Paw',   'Offers a paw for the politest handshake.',          true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"affection":1,"obedience":1}',
   'dog.paw', 'demo.dog.paw', 'icon.paw', 30, true),

-- Plain tricks
  ('dog_come',      'dog', 'Come',      'Hears their name and comes running to you.',          false, 150,
   NULL, NULL, NULL, 'baby',       0.90, '{"affection":1,"obedience":1}',
   'dog.come', 'demo.dog.come', 'icon.come', 100, false),
  ('dog_down',      'dog', 'Down',      'Lies all the way down, paws out front.',               false, 150,
   NULL, NULL, NULL, 'baby',       0.90, '{"obedience":2}',
   'dog.down', 'demo.dog.down', 'icon.down', 110, false),
  ('dog_spin',      'dog', 'Spin',      'A happy twirl in a full circle.',                      false, 150,
   NULL, NULL, NULL, 'baby',       0.90, '{"agility":2}',
   'dog.spin', 'demo.dog.spin', 'icon.spin', 120, false),
  ('dog_high_five', 'dog', 'High Five', 'Paw up high to celebrate together.',                   false, 200,
   NULL, NULL, NULL, 'young',      1.00, '{"obedience":1,"affection":1}',
   'dog.high_five', 'demo.dog.high_five', 'icon.high_five', 200, false),
  ('dog_bow',       'dog', 'Bow',       'Front paws down, tail up: a very fancy bow.',          false, 250,
   NULL, NULL, NULL, 'young',      1.00, '{"obedience":2}',
   'dog.bow', 'demo.dog.bow', 'icon.bow', 210, false),
  ('dog_roll_over', 'dog', 'Roll Over', 'Flops down and rolls all the way around, tummy up!',   false, 300,
   NULL, NULL, NULL, 'adolescent', 1.20, '{"agility":1,"obedience":1}',
   'dog.roll_over', 'demo.dog.roll_over', 'icon.roll_over', 300, false),
  ('dog_catch',     'dog', 'Catch',     'Snaps a tossed ball right out of the air.',            false, 300,
   NULL, NULL, NULL, 'adolescent', 1.20, '{"agility":2}',
   'dog.catch', 'demo.dog.catch', 'icon.catch', 310, false),
  ('dog_crawl',     'dog', 'Crawl',     'Belly low, wiggling forward like a little soldier.',   false, 350,
   NULL, NULL, NULL, 'adolescent', 1.30, '{"stamina":1,"obedience":1}',
   'dog.crawl', 'demo.dog.crawl', 'icon.crawl', 320, false),
  ('dog_play_dead', 'dog', 'Play Dead', 'Bang! A dramatic flop, then a sneaky tail wag.',       false, 500,
   NULL, NULL, NULL, 'adult',      1.50, '{"intelligence":1,"obedience":1}',
   'dog.play_dead', 'demo.dog.play_dead', 'icon.play_dead', 400, false),
  ('dog_stand_tall', 'dog', 'Stand Tall', 'Up on the back legs, front paws tucked, wobbling proudly.', false, 350,
   NULL, NULL, NULL, 'adolescent', 1.30, '{"stamina":1,"agility":1}',
   'dog.stand_tall', 'demo.dog.stand_tall', 'icon.stand_tall', 325, false),
  ('dog_sing',      'dog', 'Sing',      'A little do-re-mi of woofs that ends in a big howl.',    false, 450,
   NULL, NULL, NULL, 'adult',      1.40, '{"boldness":1,"affection":1}',
   'dog.sing', 'demo.dog.sing', 'icon.sing', 405, false),

-- Furniture tricks
  ('dog_place',        'dog', 'Place',              'Hops up onto the podium and waits like a star.',  false, 200,
   'podium', 400, 'furn_podium_classic', 'young',      1.00, '{"obedience":2}',
   'dog.place', 'demo.dog.place', 'icon.place', 220, false),
  ('dog_tunnel',       'dog', 'Through the Tunnel', 'Dashes in one end and pops out the other!',       false, 300,
   'tunnel', 450, 'furn_tunnel_pink',    'adolescent', 1.20, '{"boldness":2}',
   'dog.tunnel', 'demo.dog.tunnel', 'icon.tunnel', 330, false),
  ('dog_hurdle',       'dog', 'Jump the Hurdle',    'Takes a running start and sails over the bar.',   false, 350,
   'hurdle', 500, 'furn_hurdle_classic', 'adolescent', 1.20, '{"agility":1,"boldness":1}',
   'dog.hurdle', 'demo.dog.hurdle', 'icon.hurdle', 340, false),
  ('dog_weave',        'dog', 'Weave',              'Zig-zags in and out of the cones without a bump.',false, 500,
   'cones',  650, 'furn_cones_set',      'adult',      1.50, '{"agility":1,"intelligence":1}',
   'dog.weave', 'demo.dog.weave', 'icon.weave', 410, false),

-- ===================== CATS =====================
-- Starters
  ('cat_sit',   'cat', 'Sit',   'Sits neatly, tail curled around the paws.',          true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"obedience":2}',
   'cat.sit', 'demo.cat.sit', 'icon.sit', 10, true),
  ('cat_speak', 'cat', 'Speak', 'A tiny meow, right when you ask.',                   true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"boldness":1,"obedience":1}',
   'cat.speak', 'demo.cat.speak', 'icon.speak', 20, true),
  ('cat_paw',   'cat', 'Paw',   'Gently places one soft paw in your hand.',           true, 0,
   NULL, NULL, NULL, 'baby', 1.00, '{"affection":1,"obedience":1}',
   'cat.paw', 'demo.cat.paw', 'icon.paw', 30, true),

-- Plain tricks
  ('cat_come',      'cat', 'Come',      'Trots over, tail up, when you call.',                false, 150,
   NULL, NULL, NULL, 'baby',       0.90, '{"affection":1,"obedience":1}',
   'cat.come', 'demo.cat.come', 'icon.come', 100, false),
  ('cat_spin',      'cat', 'Spin',      'A graceful little twirl on tiptoes.',                false, 150,
   NULL, NULL, NULL, 'baby',       0.90, '{"agility":2}',
   'cat.spin', 'demo.cat.spin', 'icon.spin', 110, false),
  ('cat_high_five', 'cat', 'High Five', 'Paw up to meet your hand. Paw-some!',                false, 200,
   NULL, NULL, NULL, 'young',      1.00, '{"affection":2}',
   'cat.high_five', 'demo.cat.high_five', 'icon.high_five', 200, false),
  ('cat_lie_down',  'cat', 'Lie Down',  'Settles into a comfy loaf on command.',              false, 200,
   NULL, NULL, NULL, 'young',      1.00, '{"obedience":2}',
   'cat.lie_down', 'demo.cat.lie_down', 'icon.down', 210, false),
  ('cat_roll_over', 'cat', 'Roll Over', 'A slow, fluffy roll from one side to the other.',    false, 400,
   NULL, NULL, NULL, 'adolescent', 1.40, '{"agility":2}',
   'cat.roll_over', 'demo.cat.roll_over', 'icon.roll_over', 300, false),
  ('cat_fetch',     'cat', 'Fetch',     'Chases the ball and actually brings it back!',       false, 500,
   NULL, NULL, NULL, 'adult',      1.50, '{"intelligence":1,"boldness":1}',
   'cat.fetch', 'demo.cat.fetch', 'icon.fetch', 400, false),
  ('cat_stand_tall', 'cat', 'Stand Tall', 'Rises up on the back legs to see the world.',          false, 350,
   NULL, NULL, NULL, 'adolescent', 1.30, '{"stamina":2}',
   'cat.stand_tall', 'demo.cat.stand_tall', 'icon.stand_tall', 315, false),
  ('cat_sing',      'cat', 'Sing',      'A wobbly little meow melody, sung with total confidence.', false, 450,
   NULL, NULL, NULL, 'adult',      1.40, '{"boldness":1,"affection":1}',
   'cat.sing', 'demo.cat.sing', 'icon.sing', 405, false),

-- Furniture tricks
  ('cat_tunnel',    'cat', 'Through the Tunnel', 'Zooms through the crinkly tunnel and out the end.', false, 250,
   'tunnel', 400, 'furn_tunnel_blue',   'young',      1.10, '{"boldness":2}',
   'cat.tunnel', 'demo.cat.tunnel', 'icon.tunnel', 220, false),
  ('cat_jump_up',   'cat', 'Jump Up',            'One graceful leap up onto the stool.',              false, 300,
   'stool',  450, 'furn_stool_classic', 'adolescent', 1.20, '{"agility":1,"boldness":1}',
   'cat.jump_up', 'demo.cat.jump_up', 'icon.jump_up', 310, false),
  ('cat_hoop',      'cat', 'Jump Through Hoop',  'Leaps clean through the hoop like a circus star.',  false, 400,
   'hoop',   550, 'furn_hoop_classic',  'adolescent', 1.40, '{"agility":1,"boldness":1}',
   'cat.hoop', 'demo.cat.hoop', 'icon.hoop', 320, false),
  ('cat_place',     'cat', 'Place',              'Leaps up onto the podium and poses like a star.',   false, 200,
   'podium', 400, 'furn_podium_classic', 'young',     1.00, '{"obedience":2}',
   'cat.place', 'demo.cat.place', 'icon.place', 230, false),
  ('cat_hurdle',    'cat', 'Jump the Hurdle',    'Bounds over the bar without breaking stride.',      false, 350,
   'hurdle', 500, 'furn_hurdle_classic', 'adolescent', 1.20, '{"agility":1,"boldness":1}',
   'cat.hurdle', 'demo.cat.hurdle', 'icon.hurdle', 330, false),
  ('cat_weave',     'cat', 'Weave',              'Winds in and out of the cones, tail held high.',    false, 500,
   'cones',  650, 'furn_cones_set',      'adult',      1.50, '{"agility":1,"intelligence":1}',
   'cat.weave', 'demo.cat.weave', 'icon.weave', 410, false),

-- Dog trick added after the cat list: same hoop as the cat version.
  ('dog_hoop',      'dog', 'Jump Through Hoop',  'Sails right through the middle of the hoop.',       false, 400,
   'hoop',   550, 'furn_hoop_classic',  'adolescent', 1.40, '{"agility":1,"boldness":1}',
   'dog.hoop', 'demo.dog.hoop', 'icon.hoop', 345, false)

ON CONFLICT (id) DO UPDATE SET
  species = EXCLUDED.species, name = EXCLUDED.name, description = EXCLUDED.description,
  is_starter = EXCLUDED.is_starter, price_boops = EXCLUDED.price_boops,
  required_furniture_type = EXCLUDED.required_furniture_type,
  bundle_price_boops = EXCLUDED.bundle_price_boops, bundle_item_id = EXCLUDED.bundle_item_id,
  min_age_stage = EXCLUDED.min_age_stage, difficulty = EXCLUDED.difficulty,
  attributes_raised = EXCLUDED.attributes_raised,
  pet_animation_key = EXCLUDED.pet_animation_key, demo_animation_key = EXCLUDED.demo_animation_key,
  icon_key = EXCLUDED.icon_key, sort_order = EXCLUDED.sort_order;
  -- is_active is deliberately NOT overwritten on re-run, so tricks you've
  -- switched on stay on.

-- Read access for the app (catalog is public, read-only).
ALTER TABLE catalog_tricks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_tricks are readable" ON catalog_tricks;
CREATE POLICY "catalog_tricks are readable" ON catalog_tricks FOR SELECT USING (true);
