-- Colorway catalog metadata. Rarity is the generator tier. shop_items.tier stays scarcity.

alter table public.shop_items
  add column if not exists theme text,
  add column if not exists collection text,
  add column if not exists season text,
  add column if not exists rarity text;

alter table public.shop_items drop constraint if exists shop_items_rarity_check;
alter table public.shop_items
  add constraint shop_items_rarity_check
  check (rarity is null or rarity in ('common', 'uncommon', 'rare', 'limited', 'exclusive'));
