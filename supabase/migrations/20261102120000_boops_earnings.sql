-- Boops earnings: daily caps, new earn sources, and Pet Shop prices.
-- Prices are stored on the rows. Exclusive is 1.25x and limited is 1.5x, rounded
-- half-up to the nearest 50. The Golden Crown stays in the closet but leaves the shop.

alter table public.earn_rules add column if not exists daily_cap int;
alter table public.ledger_entries add column if not exists utc_offset_minutes int;

insert into public.earn_rules (source, key_prefix, max_amount, daily_cap) values
  ('time_clock', 'time:', 400, 400),
  ('first_open', 'first:', 50, 50),
  ('streak', 'streak:', 150, 150),
  ('activity', 'activity:', 40, 120),
  ('playdate', 'playdate:', 30, 120),
  ('competition', 'competition:', 30, 100),
  ('park_find', 'park:', 25, 75)
on conflict (source, key_prefix) do update set
  max_amount = excluded.max_amount,
  daily_cap = excluded.daily_cap;

create or replace function public.clothes_shape(item_id text, def jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(def->>'shape', ''),
    case split_part(item_id, ':', 1) || ':' || split_part(split_part(item_id, ':', 2), '.', 1)
      when 'hat:beanie-pink' then 'beanie'
      when 'hat:beanie-stripe' then 'beanie'
      when 'hat:cap-sky' then 'cap'
      when 'hat:bucket-daisy' then 'bucket'
      when 'hat:top-velvet' then 'top'
      when 'boots:rain-blue' then 'rain'
      when 'boots:sneaker-pink' then 'sneaker'
      when 'boots:sneaker-gold' then 'sneaker'
      when 'jacket:puffer-mint' then 'puffer'
      when 'jacket:sweater-lilac' then 'sweater'
      when 'jacket:puffer-rainbow' then 'puffer'
      when 'jacket:rain' then 'raincoat'
      when 'neckwear:bandana-cherry' then 'bandana'
      when 'neckwear:scarf-stripe' then 'scarf'
      when 'neckwear:bandana-gingham' then 'bandana'
      when 'neckwear:bowtie-plaid' then 'bowtie'
      when 'neckwear:bell' then 'collar'
      when 'neckwear:gold' then 'collar'
      when 'glasses:heart-sky' then 'heart'
      else split_part(split_part(item_id, ':', 2), '.', 1)
    end
  );
$$;

create or replace function public.clothes_price(item_id text, def jsonb, tier text)
returns int
language sql
immutable
as $$
  with base as (
    select case public.clothes_shape(item_id, def)
      when 'bandana' then 500
      when 'bow' then 500
      when 'collar' then 600
      when 'scarf' then 700
      when 'bowtie' then 800
      when 'square' then 900
      when 'red-rim' then 900
      when 'classic' then 900
      when 'star' then 900
      when 'heart' then 900
      when 'beanie' then 1000
      when 'cap' then 1100
      when 'bucket' then 1200
      when 'party' then 1300
      when 'beret' then 1400
      when 'top' then 1800
      when 'rain' then 2000
      when 'sneaker' then 2000
      when 'sweater' then 2800
      when 'vest' then 2800
      when 'puffer' then 3200
      when 'hoodie' then 3200
      when 'raincoat' then 3600
      else null
    end as amount
  )
  select case
    when amount is null then null
    when tier = 'exclusive' then (round(amount * 1.25 / 50.0) * 50)::int
    when tier = 'limited' then (round(amount * 1.5 / 50.0) * 50)::int
    else amount
  end
  from base;
$$;

update public.shop_items
set price = public.clothes_price(id, def, tier)
where category = 'clothes'
  and id <> 'hat:crown'
  and public.clothes_price(id, def, tier) is not null;

update public.shop_items
set shop = 'hidden', active = false
where id = 'hat:crown';

update public.shop_items set price = case id
  when 'crinkle' then 600
  when 'squeaky' then 800
  when 'yarn' then 800
  when 'mouse' then 800
  when 'bone' then 900
  when 'rope' then 1000
  when 'frisbee' then 1200
  when 'wand' then 1500
  when 'laser' then 2000
  when 'biscuit' then 10
  when 'special' then 120
  when 'treat_jerky' then 150
  when 'treat_tuna' then 150
  when 'food_gourmet' then 200
  when 'food_steak' then 200
  when 'food_fish' then 200
  when 'second_wind' then 250
  when 'bowl_food' then 600
  when 'bowl_water' then 600
  when 'bed_standard' then 2500
  when 'scratcher' then 3000
  when 'bed_cloud_puff' then 5000
  when 'bed_kitty_cave' then 5000
  when 'bed_bone_sofa' then 7500
  when 'bed_moon_cradle' then 7500
  when 'dogHouse' then 9000
  when 'catTree' then 10000
  else price
end
where id in (
  'crinkle', 'squeaky', 'yarn', 'mouse', 'bone', 'rope', 'frisbee', 'wand', 'laser',
  'biscuit', 'special', 'treat_jerky', 'treat_tuna', 'food_gourmet', 'food_steak', 'food_fish', 'second_wind',
  'bowl_food', 'bowl_water', 'bed_standard', 'scratcher', 'bed_cloud_puff', 'bed_kitty_cave',
  'bed_bone_sofa', 'bed_moon_cradle', 'dogHouse', 'catTree'
);

update public.shop_items
set description = 'Ends the training break and gives +10 energy'
where id = 'second_wind';

update public.shop_bundles set price = 80 where id = 'treat_bag';
update public.shop_bundles set price = 175 where id = 'treat_tin';

create table if not exists public.economy_config (
  id int primary key,
  version int not null,
  config jsonb not null,
  constraint economy_config_singleton check (id = 1)
);

alter table public.economy_config enable row level security;
revoke all on public.economy_config from anon, authenticated;
grant select on public.economy_config to anon, authenticated;
drop policy if exists economy_config_read on public.economy_config;
create policy economy_config_read on public.economy_config for select to anon, authenticated using (true);

insert into public.economy_config (id, version, config) values (
  1,
  2,
  '{
    "timeAccrual": {"boopsPerHour": 60, "payoutStep": 15, "awayCapHours": 8, "dailyCap": 400},
    "firstOpen": {"boops": 50},
    "streak": {"length": 7, "bonus": 150, "graceDays": 1},
    "dayBoundary": {"minGapHours": 20},
    "activities": {"boops": 40, "dailyCap": 120},
    "playdate": {"boops": 30, "dailyCap": 120},
    "competition": {"finish": 10, "top3": 30, "dailyCap": 100},
    "parkFind": {"boops": 25, "dailyCap": 75},
    "levelUp": {"boops": 50},
    "milestones": {"trickMastered": 100, "lifeStage": 200},
    "secondWind": {"dailyLimitPerPet": 5, "energy": 10},
    "exclusiveMultiplier": 1.25,
    "limitedMultiplier": 1.5
  }'::jsonb
)
on conflict (id) do update set version = excluded.version, config = excluded.config;

create or replace function public.append_ledger_entries(
  p_device_id text,
  p_entries jsonb,
  p_replay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gate text;
  entry jsonb;
  results jsonb := '[]'::jsonb;
  key text;
  kind text;
  entry_source text;
  lines jsonb;
  boops int;
  payout_boops int;
  rule_max int;
  day_cap int;
  prefix text;
  status text;
  flags text[] := '{}';
  time_anchor timestamptz;
  time_budget int;
  time_spent int := 0;
  already int;
  server_day text;
  entry_offset int;
  prev_day text;
  prev_offset int;
  prev_time timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return to_jsonb(gate);
  end if;

  select coalesce(
    (select max(l.server_time) from public.ledger_entries l where l.user_id = uid and l.source in ('time_payout', 'time_clock')),
    (select u.created_at from auth.users u where u.id = uid),
    now()
  ) into time_anchor;
  time_budget := greatest(0, floor(extract(epoch from (now() - time_anchor)) / 60)::int);

  for entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    key := entry->>'idempotency_key';
    kind := entry->>'kind';
    entry_source := entry->>'source';
    lines := coalesce(entry->'lines', '[]'::jsonb);
    status := 'ok';
    flags := '{}';
    payout_boops := 0;
    boops := 0;
    entry_offset := nullif(entry->>'utc_offset_minutes', '')::int;

    if exists(select 1 from public.ledger_entries where user_id = uid and idempotency_key = key) then
      results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', 'duplicate'));
      continue;
    end if;

    if kind is null or kind not in ('purchase', 'spend', 'earn', 'consume', 'reversal') or key is null then
      status := 'invalid';
    elsif p_replay and kind not in ('purchase', 'spend', 'reversal') then
      status := 'invalid';
    elsif kind = 'earn' then
      select coalesce(sum((line->>'qty')::int), 0) into boops
        from jsonb_array_elements(lines) line
        where line->>'asset' = 'boops';
      select key_prefix, max_amount, daily_cap into prefix, rule_max, day_cap
        from public.earn_rules
        where earn_rules.source = entry_source and key like key_prefix || '%'
        order by length(key_prefix) desc
        limit 1;
      if prefix is null then
        status := 'invalid';
      elsif rule_max is not null and boops > rule_max then
        status := 'invalid';
      end if;
      if status = 'ok' and day_cap is not null and coalesce(entry->>'local_day', '') <> '' then
        select coalesce(sum((line->>'qty')::int), 0) into already
          from public.ledger_entries e
          cross join lateral jsonb_array_elements(e.lines) line
          where e.user_id = uid
            and e.source = entry_source
            and e.local_day = entry->>'local_day'
            and line->>'asset' = 'boops';
        if boops + already > day_cap then
          status := 'invalid';
        end if;
      end if;
      if status = 'ok' and entry_source in ('time_clock', 'first_open', 'streak', 'activity', 'playdate', 'competition', 'park_find') then
        if coalesce(entry->>'local_day', '') = '' then
          status := 'invalid';
        else
          server_day := to_char((now() at time zone 'utc') + make_interval(mins => coalesce(entry_offset, 0)), 'YYYY-MM-DD');
          if entry->>'local_day' > server_day then
            status := 'invalid';
          end if;
        end if;
      end if;
      if status = 'ok' and entry_source in ('first_open', 'streak', 'activity', 'playdate', 'competition', 'park_find') then
        select e.local_day, e.utc_offset_minutes, e.server_time
          into prev_day, prev_offset, prev_time
          from public.ledger_entries e
          where e.user_id = uid and e.source = 'first_open'
          order by e.server_time desc
          limit 1;
        if prev_offset is not null
          and entry_offset is not null
          and entry_offset is distinct from prev_offset
          and entry->>'local_day' > prev_day
          and now() - prev_time < interval '20 hours' then
          status := 'invalid';
        end if;
      end if;
      if status = 'ok' and entry_source in ('time_payout', 'time_clock') then
        payout_boops := boops;
        if payout_boops < 0 or payout_boops > time_budget - time_spent then
          status := 'invalid';
        end if;
      end if;
    elsif kind in ('purchase', 'spend') then
      select coalesce(sum((line->>'qty')::int), 0) into boops
        from jsonb_array_elements(lines) line
        where line->>'asset' = 'boops';
      if boops > 0 then
        status := 'invalid';
      elsif boops = 0 and exists (
        select 1 from jsonb_array_elements(lines) line
        where line->>'asset' in ('toy', 'furniture') and coalesce((line->>'qty')::int, 0) > 0
      ) then
        status := 'invalid';
      end if;
    end if;

    if status = 'ok' then
      insert into public.ledger_entries (
        user_id, idempotency_key, kind, source, lines, reverses_key, local_day, flags, device_id, device_time, utc_offset_minutes
      ) values (
        uid,
        key,
        kind,
        entry_source,
        lines,
        entry->>'reverses_key',
        entry->>'local_day',
        flags,
        p_device_id,
        nullif(entry->>'device_time', '')::timestamptz,
        entry_offset
      );
      if entry_source in ('time_payout', 'time_clock') and payout_boops > 0 then
        time_spent := time_spent + payout_boops;
      end if;
    end if;

    results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', status, 'flags', flags));
  end loop;

  return results;
end;
$$;
