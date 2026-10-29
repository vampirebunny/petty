-- Park finds catalog. Sibling to shop_*; collectibles only, never sold.
-- Owner applies with `supabase db push`.

create table public.park_finds_config (
  id int primary key default 1 check (id = 1),
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table public.park_finds (
  id text primary key,
  name text not null,
  species text not null check (species in ('dog', 'cat', 'both')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'legendary')),
  condition_type text not null check (condition_type in ('always', 'season', 'weather', 'time', 'moon', 'date_window')),
  condition_value text,
  sort_order int not null default 0,
  art_key text not null,
  active boolean not null default true
);

create or replace function public.bump_park_finds_version()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'park_finds_config' then
    if tg_op = 'UPDATE' and new.version is not distinct from old.version then
      new.version := old.version + 1;
    end if;
    new.updated_at := now();
    return new;
  end if;
  update public.park_finds_config
    set version = version + 1
    where id = 1;
  return null;
end;
$$;

create trigger park_finds_config_bump
  before update on public.park_finds_config
  for each row execute function public.bump_park_finds_version();

create trigger park_finds_bump
  after insert or update or delete on public.park_finds
  for each statement execute function public.bump_park_finds_version();

alter table public.park_finds_config enable row level security;
alter table public.park_finds enable row level security;

revoke all on public.park_finds_config, public.park_finds from anon, authenticated;
grant select on public.park_finds_config, public.park_finds to anon, authenticated;

create policy park_finds_config_read on public.park_finds_config for select to anon, authenticated using (true);
create policy park_finds_read on public.park_finds for select to anon, authenticated using (true);

insert into public.park_finds_config (id, version) values (1, 1);

insert into public.park_finds
  (id, name, species, rarity, condition_type, condition_value, sort_order, art_key, active)
values
  ('perfect-stick', 'Perfect stick', 'dog', 'common', 'always', NULL, 10, 'perfect-stick', true),
  ('tennis-ball', 'Tennis ball', 'dog', 'common', 'always', NULL, 20, 'tennis-ball', true),
  ('buried-bone', 'Buried bone', 'dog', 'uncommon', 'always', NULL, 30, 'buried-bone', true),
  ('rope-toy', 'Rope toy', 'dog', 'uncommon', 'always', NULL, 40, 'rope-toy', true),
  ('lost-frisbee', 'Lost frisbee', 'dog', 'uncommon', 'always', NULL, 50, 'lost-frisbee', true),
  ('squeaky-duck', 'Squeaky duck', 'dog', 'rare', 'always', NULL, 60, 'squeaky-duck', true),
  ('dinosaur-bone', 'Dinosaur bone', 'dog', 'legendary', 'always', NULL, 70, 'dinosaur-bone', true),
  ('blue-jay-feather', 'Blue jay feather', 'cat', 'common', 'always', NULL, 80, 'blue-jay-feather', true),
  ('toy-mouse', 'Toy mouse', 'cat', 'common', 'always', NULL, 90, 'toy-mouse', true),
  ('jingle-bell-ball', 'Jingle bell ball', 'cat', 'uncommon', 'always', NULL, 100, 'jingle-bell-ball', true),
  ('cats-eye-marble', 'Cat''s eye marble', 'cat', 'rare', 'always', NULL, 110, 'cats-eye-marble', true),
  ('golden-yarn-ball', 'Golden yarn ball', 'cat', 'legendary', 'always', NULL, 120, 'golden-yarn-ball', true),
  ('smooth-pebble', 'Smooth pebble', 'both', 'common', 'always', NULL, 130, 'smooth-pebble', true),
  ('clover', 'Clover', 'both', 'common', 'always', NULL, 140, 'clover', true),
  ('snail-shell', 'Snail shell', 'both', 'common', 'always', NULL, 150, 'snail-shell', true),
  ('heart-shaped-rock', 'Heart-shaped rock', 'both', 'uncommon', 'always', NULL, 160, 'heart-shaped-rock', true),
  ('toy-crown', 'Toy crown', 'both', 'uncommon', 'always', NULL, 170, 'toy-crown', true),
  ('tiny-key', 'Tiny key', 'both', 'rare', 'always', NULL, 180, 'tiny-key', true),
  ('old-compass', 'Old compass', 'both', 'rare', 'always', NULL, 190, 'old-compass', true),
  ('message-in-a-bottle', 'Message in a bottle', 'both', 'rare', 'always', NULL, 200, 'message-in-a-bottle', true),
  ('dandelion-puff', 'Dandelion puff', 'both', 'common', 'season', 'spring', 210, 'dandelion-puff', true),
  ('cherry-blossom-petal', 'Cherry blossom petal', 'both', 'uncommon', 'season', 'spring', 220, 'cherry-blossom-petal', true),
  ('four-leaf-clover', 'Four-leaf clover', 'both', 'rare', 'season', 'spring', 230, 'four-leaf-clover', true),
  ('seashell', 'Seashell', 'both', 'common', 'season', 'summer', 240, 'seashell', true),
  ('sea-glass', 'Sea glass', 'both', 'rare', 'season', 'summer', 250, 'sea-glass', true),
  ('red-maple-leaf', 'Red maple leaf', 'both', 'common', 'season', 'fall', 260, 'red-maple-leaf', true),
  ('acorn', 'Acorn', 'both', 'common', 'season', 'fall', 270, 'acorn', true),
  ('golden-acorn', 'Golden acorn', 'both', 'legendary', 'season', 'fall', 280, 'golden-acorn', true),
  ('pinecone', 'Pinecone', 'both', 'common', 'season', 'winter', 290, 'pinecone', true),
  ('holly-sprig', 'Holly sprig', 'both', 'common', 'season', 'winter', 300, 'holly-sprig', true),
  ('lost-mitten', 'Lost mitten', 'both', 'uncommon', 'season', 'winter', 310, 'lost-mitten', true),
  ('paper-boat', 'Paper boat', 'both', 'uncommon', 'weather', 'rain', 320, 'paper-boat', true),
  ('snow-globe', 'Snow globe', 'both', 'rare', 'weather', 'snow', 330, 'snow-globe', true),
  ('rainbow-marble', 'Rainbow marble', 'both', 'rare', 'weather', 'rainbow', 340, 'rainbow-marble', true),
  ('dewdrop-gem', 'Dewdrop gem', 'both', 'rare', 'time', 'dawn', 350, 'dewdrop-gem', true),
  ('glow-stone', 'Glow stone', 'both', 'rare', 'time', 'night', 360, 'glow-stone', true),
  ('fallen-star', 'Fallen star', 'both', 'legendary', 'time', 'night', 370, 'fallen-star', true),
  ('moonstone', 'Moonstone', 'both', 'legendary', 'moon', 'full', 380, 'moonstone', true),
  ('heart-locket', 'Heart locket', 'both', 'uncommon', 'date_window', '02-10..02-14', 390, 'heart-locket', true),
  ('jack-o-lantern-charm', 'Jack-o''-lantern charm', 'both', 'uncommon', 'date_window', '10-25..10-31', 400, 'jack-o-lantern-charm', true),
  ('snowflake-ornament', 'Snowflake ornament', 'both', 'uncommon', 'date_window', '12-20..12-26', 410, 'snowflake-ornament', true),
  ('party-hat', 'Party hat', 'both', 'uncommon', 'date_window', '12-31..01-01', 420, 'party-hat', true);
