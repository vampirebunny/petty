-- Awards tables, config, seed, and grant functions.
-- The phone never inserts awards. grant_race_awards / grant_runway_awards are
-- service_role only until Phase 3/4 wire them into finalize and show RPCs.
--
-- Checks: retry the same race_id → one ribbon; Fun Run / 800 Meters never get a
-- class trophy; cup = friends grants nothing; the third classed (non-championship)
-- win inserts the class trophy.
-- The owner applies this. Do not run it against the hosted project from an agent.

create table public.awards_config (
  id int primary key,
  config_version int not null,
  thresholds jsonb not null,
  seasons jsonb not null default '[]'::jsonb,
  constraint awards_config_singleton check (id = 1)
);

insert into public.awards_config (id, config_version, thresholds, seasons) values (
  1,
  1,
  jsonb_build_object(
    'ribbonPlacings', jsonb_build_array(1, 2, 3),
    'classTrophyWins', 3,
    'championshipStreak', 3,
    'careerTiers', jsonb_build_array(5, 15, 40, 100, 250),
    'photoFinishMarginSec', 0.1,
    'winStreakFeat', 5,
    'veteranTiers', jsonb_build_array(1, 5, 15),
    'coverTiers', jsonb_build_array(5, 15, 40, 100),
    'soloShowsCountedPerDay', 3,
    'encoreShows', 5,
    'hostTiers', jsonb_build_array(1, 5, 15),
    'runwayCrewTiers', jsonb_build_array(3, 10, 25),
    'frontRowTiers', jsonb_build_array(10, 30, 75),
    'lifetimeWinsTiers', jsonb_build_array(100, 500, 1000),
    'lifetimeShowsTiers', jsonb_build_array(50, 200, 500),
    'trophyCollectorTiers', jsonb_build_array(25, 100, 250),
    'lookbookTierStamps', jsonb_build_object(
      'bronze', jsonb_build_array('debut'),
      'silver', jsonb_build_array('debut', 'encore', 'party'),
      'gold', jsonb_build_array('debut', 'encore', 'party', 'rack')
    )
  ),
  '[]'::jsonb
);

create table public.award_definitions (
  id text primary key,
  family text not null check (family in ('race', 'runway', 'lifetime')),
  kind text not null check (kind in ('ribbon', 'trophy', 'sash', 'cover', 'stamp')),
  track text not null,
  event_type text,
  class text,
  theme_id text,
  tier text,
  threshold int,
  size int not null default 1,
  available_from timestamptz,
  available_until timestamptz,
  art_key text
);

do $$
declare
  classed text[] := array['dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle'];
  opens text[] := array['funRun', 'meters800'];
  ev text;
  cls text;
  tier text;
  theme text;
  kind text;
  career_tiers text[] := array['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  career_need int[] := array[5, 15, 40, 100, 250];
  classes text[] := array['beginner', 'novice', 'open', 'expert', 'championship'];
  themes text[] := array['space', 'sea', 'royal', 'beach', 'winter', 'rock', 'garden', 'spooky', 'west', 'hero', 'pirate', 'safari'];
  stamps text[] := array['debut', 'encore', 'party', 'rack', 'star'];
  metals text[] := array['bronze', 'silver', 'gold'];
  cover_tiers text[] := array['bronze', 'silver', 'gold', 'platinum'];
  i int;
begin
  insert into public.award_definitions (id, family, kind, track, art_key, size)
  values ('ribbon', 'race', 'ribbon', 'ribbon', 'ribbon', 1);

  foreach ev in array (classed || opens) loop
    for i in 1..5 loop
      insert into public.award_definitions (id, family, kind, track, event_type, tier, threshold, size, art_key)
      values (
        'career_' || ev || '_' || career_tiers[i],
        'race', 'trophy', 'career', ev, career_tiers[i], career_need[i], i,
        'career:' || ev || ':' || career_tiers[i]
      );
    end loop;
  end loop;

  foreach ev in array classed loop
    for i in 1..5 loop
      insert into public.award_definitions (id, family, kind, track, event_type, class, threshold, size, art_key)
      values (
        'class_' || ev || '_' || classes[i],
        'race', 'trophy', 'class', ev, classes[i], 3, i,
        'class:' || ev || ':' || classes[i]
      );
    end loop;
  end loop;

  insert into public.award_definitions (id, family, kind, track, size, art_key) values
    ('feat_flawless', 'race', 'trophy', 'feat', 3, 'feat:flawless'),
    ('feat_photo_finish', 'race', 'trophy', 'feat', 3, 'feat:photo_finish'),
    ('feat_comeback', 'race', 'trophy', 'feat', 3, 'feat:comeback'),
    ('feat_win_streak', 'race', 'trophy', 'feat', 3, 'feat:win_streak'),
    ('feat_perfect_recall', 'race', 'trophy', 'feat', 3, 'feat:perfect_recall'),
    ('feat_personal_best', 'race', 'trophy', 'feat', 2, 'feat:personal_best');

  foreach cls in array classes loop
    insert into public.award_definitions (id, family, kind, track, class, size, art_key)
    values ('range_all_rounder_' || cls, 'race', 'trophy', 'range', cls, 4, 'range:all_rounder:' || cls);
  end loop;
  insert into public.award_definitions (id, family, kind, track, size, art_key)
  values ('range_grand_champion', 'race', 'trophy', 'range', 5, 'range:grand_champion');

  insert into public.award_definitions (id, family, kind, track, tier, threshold, size, art_key) values
    ('veteran_bronze', 'race', 'trophy', 'veteran', 'bronze', 1, 2, 'veteran:bronze'),
    ('veteran_silver', 'race', 'trophy', 'veteran', 'silver', 5, 3, 'veteran:silver'),
    ('veteran_gold', 'race', 'trophy', 'veteran', 'gold', 15, 4, 'veteran:gold');

  foreach theme in array themes loop
    foreach kind in array stamps loop
      insert into public.award_definitions (id, family, kind, track, theme_id, art_key, size)
      values ('stamp_' || theme || '_' || kind, 'runway', 'stamp', 'lookbook', theme, 'stamp:' || theme || ':' || kind, 1);
    end loop;
  end loop;

  insert into public.award_definitions (id, family, kind, track, tier, size, art_key) values
    ('lookbook_bronze', 'runway', 'trophy', 'lookbook', 'bronze', 2, 'lookbook:bronze'),
    ('lookbook_silver', 'runway', 'trophy', 'lookbook', 'silver', 3, 'lookbook:silver'),
    ('lookbook_gold', 'runway', 'trophy', 'lookbook', 'gold', 4, 'lookbook:gold');

  for i in 1..4 loop
    insert into public.award_definitions (id, family, kind, track, tier, threshold, size, art_key)
    values (
      'cover_' || cover_tiers[i],
      'runway', 'cover', 'covers', cover_tiers[i],
      (array[5, 15, 40, 100])[i], i, 'cover:' || cover_tiers[i]
    );
  end loop;

  for i in 1..3 loop
    insert into public.award_definitions (id, family, kind, track, tier, threshold, size, art_key) values
      ('friend_host_' || metals[i], 'runway', 'cover', 'friends', metals[i], (array[1, 5, 15])[i], i, 'friend:host:' || metals[i]),
      ('friend_crew_' || metals[i], 'runway', 'cover', 'friends', metals[i], (array[3, 10, 25])[i], i, 'friend:crew:' || metals[i]),
      ('friend_front_' || metals[i], 'runway', 'cover', 'friends', metals[i], (array[10, 30, 75])[i], i, 'friend:front:' || metals[i]);
  end loop;

  insert into public.award_definitions (id, family, kind, track, art_key, size)
  values ('crowd_favorite', 'runway', 'sash', 'crowd', 'sash:crowd', 1);

  for i in 1..3 loop
    insert into public.award_definitions (id, family, kind, track, tier, threshold, size, art_key) values
      ('lifetime_wins_' || metals[i], 'lifetime', 'trophy', 'lifetime', metals[i], (array[100, 500, 1000])[i], i + 2, 'lifetime:wins:' || metals[i]),
      ('lifetime_shows_' || metals[i], 'lifetime', 'trophy', 'lifetime', metals[i], (array[50, 200, 500])[i], i + 2, 'lifetime:shows:' || metals[i]),
      ('lifetime_collector_' || metals[i], 'lifetime', 'trophy', 'lifetime', metals[i], (array[25, 100, 250])[i], i + 2, 'lifetime:collector:' || metals[i]);
  end loop;
end
$$;

create table public.awards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete cascade,
  award_definition_id text not null references public.award_definitions (id),
  pet_snapshot jsonb not null default '{}'::jsonb,
  source text not null check (source in ('race', 'runway')),
  race_id uuid references public.races (id) on delete set null,
  show_id uuid references public.runway_shows (id) on delete set null,
  place int,
  earned_at timestamptz not null default now(),
  config_version int not null
);

create unique index awards_ribbon_once on public.awards (race_id, pet_id)
  where award_definition_id = 'ribbon';
create unique index awards_once_pet on public.awards (pet_id, award_definition_id)
  where pet_id is not null and award_definition_id <> 'ribbon' and award_definition_id <> 'crowd_favorite';
create unique index awards_once_player on public.awards (player_id, award_definition_id)
  where pet_id is null;
create unique index awards_sash_show on public.awards (show_id, pet_id)
  where award_definition_id = 'crowd_favorite';
create index awards_player_pet on public.awards (player_id, pet_id);

create table public.award_progress (
  player_id uuid not null references auth.users (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete cascade,
  counter_key text not null,
  value numeric not null default 0,
  updated_at timestamptz not null default now()
);

create unique index award_progress_pet
  on public.award_progress (player_id, pet_id, counter_key) where pet_id is not null;
create unique index award_progress_player
  on public.award_progress (player_id, counter_key) where pet_id is null;

create table public.runway_pieces_worn (
  pet_id uuid not null references public.pets (id) on delete cascade,
  theme_id text not null references public.runway_themes (id),
  piece_id text not null,
  primary key (pet_id, theme_id, piece_id)
);

alter table public.race_entries add column if not exists halfway_place int;
alter table public.race_entries add column if not exists hurdles_missed int;
alter table public.race_entries add column if not exists trick_seq_len int;
alter table public.race_entries add column if not exists trick_misses int;

alter table public.awards_config enable row level security;
alter table public.award_definitions enable row level security;
alter table public.awards enable row level security;
alter table public.award_progress enable row level security;
alter table public.runway_pieces_worn enable row level security;

revoke all on table public.awards_config from public, anon, authenticated;
revoke all on table public.award_definitions from public, anon, authenticated;
revoke all on table public.awards from public, anon, authenticated;
revoke all on table public.award_progress from public, anon, authenticated;
revoke all on table public.runway_pieces_worn from public, anon, authenticated;

grant select on table public.awards_config to anon, authenticated;
grant select on table public.award_definitions to anon, authenticated;
grant select on table public.awards to authenticated;
grant select on table public.award_progress to authenticated;
grant select on table public.runway_pieces_worn to authenticated;
grant all on table public.awards_config to service_role;
grant all on table public.award_definitions to service_role;
grant all on table public.awards to service_role;
grant all on table public.award_progress to service_role;
grant all on table public.runway_pieces_worn to service_role;

create policy awards_config_read on public.awards_config for select to anon, authenticated using (true);
create policy award_definitions_read on public.award_definitions for select to anon, authenticated using (true);
create policy awards_own on public.awards for select to authenticated using (player_id = auth.uid());
create policy award_progress_own on public.award_progress for select to authenticated using (player_id = auth.uid());
create policy runway_pieces_worn_own on public.runway_pieces_worn
  for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and p.owner_user_id = auth.uid()));

create or replace function public.award_add_progress(
  p_player uuid,
  p_pet uuid,
  p_key text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v numeric;
begin
  if p_pet is null then
    insert into public.award_progress (player_id, pet_id, counter_key, value)
    values (p_player, null, p_key, p_delta)
    on conflict (player_id, counter_key) where pet_id is null
    do update set value = public.award_progress.value + excluded.value, updated_at = now()
    returning value into v;
  else
    insert into public.award_progress (player_id, pet_id, counter_key, value)
    values (p_player, p_pet, p_key, p_delta)
    on conflict (player_id, pet_id, counter_key) where pet_id is not null
    do update set value = public.award_progress.value + excluded.value, updated_at = now()
    returning value into v;
  end if;
  return v;
end;
$$;

create or replace function public.award_set_progress(
  p_player uuid,
  p_pet uuid,
  p_key text,
  p_value numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pet is null then
    insert into public.award_progress (player_id, pet_id, counter_key, value)
    values (p_player, null, p_key, p_value)
    on conflict (player_id, counter_key) where pet_id is null
    do update set value = excluded.value, updated_at = now();
  else
    insert into public.award_progress (player_id, pet_id, counter_key, value)
    values (p_player, p_pet, p_key, p_value)
    on conflict (player_id, pet_id, counter_key) where pet_id is not null
    do update set value = excluded.value, updated_at = now();
  end if;
  return p_value;
end;
$$;

create or replace function public.award_progress_value(
  p_player uuid,
  p_pet uuid,
  p_key text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select value
  from public.award_progress
  where player_id = p_player
    and counter_key = p_key
    and pet_id is not distinct from p_pet;
$$;

create or replace function public.award_pet_snapshot(p_entry public.race_entries, p_pet public.pets)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'name', coalesce(p_entry.pet_name, p_pet.doc->>'name'),
    'species', coalesce(p_entry.species, p_pet.doc->>'species'),
    'breed', coalesce(p_entry.breed_id, p_pet.doc->>'breedId'),
    'coat', coalesce(p_pet.doc->'look'->>'coat', p_entry.coat->>'coat'),
    'seed', p_pet.doc->'attributes'->'seed'
  );
$$;

create or replace function public.award_doc_snapshot(p_pet public.pets)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'name', p_pet.doc->>'name',
    'species', p_pet.doc->>'species',
    'breed', p_pet.doc->>'breedId',
    'coat', p_pet.doc->'look'->>'coat',
    'seed', p_pet.doc->'attributes'->'seed'
  );
$$;

create or replace function public.award_try_insert(
  p_player uuid,
  p_pet uuid,
  p_def text,
  p_snapshot jsonb,
  p_source text,
  p_race uuid,
  p_show uuid,
  p_placing int,
  p_version int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.awards (
    player_id, pet_id, award_definition_id, pet_snapshot, source, race_id, show_id, place, config_version
  ) values (
    p_player, p_pet, p_def, coalesce(p_snapshot, '{}'::jsonb), p_source, p_race, p_show, p_placing, p_version
  )
  on conflict do nothing
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.award_grant_thresholds(
  p_player uuid,
  p_pet uuid,
  p_snapshot jsonb,
  p_source text,
  p_race uuid,
  p_show uuid,
  p_track text,
  p_prefix text,
  p_value numeric,
  p_tiers int[],
  p_tier_names text[],
  p_version int
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  granted uuid[] := '{}';
  i int;
  new_id uuid;
begin
  for i in 1..coalesce(array_length(p_tiers, 1), 0) loop
    if p_value >= p_tiers[i] then
      new_id := public.award_try_insert(
        p_player, p_pet, p_prefix || p_tier_names[i], p_snapshot, p_source, p_race, p_show, null, p_version
      );
      if new_id is not null then
        granted := granted || new_id;
      end if;
    end if;
  end loop;
  return granted;
end;
$$;

create or replace function public.award_lifetime_collector(p_player uuid, p_version int)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  n numeric;
  granted uuid[];
begin
  select count(*) into n
  from public.awards a
  join public.award_definitions d on d.id = a.award_definition_id
  where a.player_id = p_player and d.kind = 'trophy';
  perform public.award_set_progress(p_player, null, 'lifetime_trophies', n);
  select public.award_grant_thresholds(
    p_player, null, '{}'::jsonb, 'race', null, null, 'lifetime', 'lifetime_collector_',
    n, array[25, 100, 250], array['bronze', 'silver', 'gold'], p_version
  ) into granted;
  return granted;
end;
$$;

create or replace function public.grant_race_awards(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.awards_config%rowtype;
  race public.races%rowtype;
  ev public.competition_events%rowtype;
  entry public.race_entries%rowtype;
  petrow public.pets%rowtype;
  granted uuid[] := '{}';
  new_id uuid;
  extra uuid[];
  ribbon_class text;
  classed boolean;
  snap jsonb;
  wins numeric;
  class_wins numeric;
  streak numeric;
  champ numeric;
  veteran numeric;
  lifetime numeric;
  second_ms int;
  field_size int;
  pb_key text;
  pb numeric;
  cls text;
begin
  select * into cfg from public.awards_config where id = 1;
  select * into race from public.races where id = p_race_id;
  if not found or race.status = 'cancelled' then
    return '[]'::jsonb;
  end if;
  select * into ev from public.competition_events where id = race.event_id;
  if ev.cup = 'friends' then
    return '[]'::jsonb;
  end if;

  classed := ev.event_type not in ('funRun', 'meters800');
  ribbon_class := case
    when ev.cup = 'veteran' then 'veteran'
    when not classed then 'none'
    else race.class
  end;
  select count(*) into field_size from public.race_entries where race_id = p_race_id and status = 'finished';

  for entry in
    select * from public.race_entries
    where race_id = p_race_id
      and not is_npc
      and status = 'finished'
      and finish_ms is not null
      and pet_id is not null
      and player_id is not null
  loop
    select * into petrow from public.pets where id = entry.pet_id;
    snap := public.award_pet_snapshot(entry, petrow);

    if entry.place between 1 and 3 then
      new_id := public.award_try_insert(
        entry.player_id, entry.pet_id, 'ribbon', snap, 'race', p_race_id, null, entry.place, cfg.config_version
      );
      if new_id is not null then
        granted := granted || new_id;
      end if;
    end if;

    if entry.place = 1 then
      wins := public.award_add_progress(entry.player_id, entry.pet_id, 'wins:' || ev.event_type, 1);
      extra := public.award_grant_thresholds(
        entry.player_id, entry.pet_id, snap, 'race', p_race_id, null, 'career',
        'career_' || ev.event_type || '_',
        wins, array[5, 15, 40, 100, 250],
        array['bronze', 'silver', 'gold', 'platinum', 'diamond'],
        cfg.config_version
      );
      granted := granted || extra;

      if classed and ev.cup <> 'veteran' then
        class_wins := public.award_add_progress(
          entry.player_id, entry.pet_id, 'class_wins:' || ev.event_type || ':' || race.class, 1
        );
        if race.class = 'championship' then
          champ := public.award_add_progress(entry.player_id, entry.pet_id, 'champ_streak:' || ev.event_type, 1);
          if champ >= 3 then
            new_id := public.award_try_insert(
              entry.player_id, entry.pet_id, 'class_' || ev.event_type || '_championship',
              snap, 'race', p_race_id, null, null, cfg.config_version
            );
            if new_id is not null then granted := granted || new_id; end if;
          end if;
        elsif class_wins >= 3 then
          new_id := public.award_try_insert(
            entry.player_id, entry.pet_id, 'class_' || ev.event_type || '_' || race.class,
            snap, 'race', p_race_id, null, null, cfg.config_version
          );
          if new_id is not null then granted := granted || new_id; end if;
        end if;

        foreach cls in array array['beginner', 'novice', 'open', 'expert', 'championship'] loop
          if (
            select count(*) from (
              select 1
              from unnest(array['dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle']) e(id)
              where coalesce(public.award_progress_value(entry.player_id, entry.pet_id, 'class_wins:' || e.id || ':' || cls), 0) >= 1
            ) s
          ) = 6 then
            new_id := public.award_try_insert(
              entry.player_id, entry.pet_id, 'range_all_rounder_' || cls,
              snap, 'race', p_race_id, null, null, cfg.config_version
            );
            if new_id is not null then granted := granted || new_id; end if;
          end if;
        end loop;

        if (
          select count(*) from public.awards a
          where a.pet_id = entry.pet_id
            and a.award_definition_id in (
              'class_dockDive_championship', 'class_sniffOut_championship', 'class_trickShow_championship',
              'class_hurdles_championship', 'class_weave_championship', 'class_obstacle_championship'
            )
        ) = 6 then
          new_id := public.award_try_insert(
            entry.player_id, entry.pet_id, 'range_grand_champion',
            snap, 'race', p_race_id, null, null, cfg.config_version
          );
          if new_id is not null then granted := granted || new_id; end if;
        end if;
      end if;

      if ev.cup = 'veteran' then
        veteran := public.award_add_progress(entry.player_id, entry.pet_id, 'veteran_wins', 1);
        extra := public.award_grant_thresholds(
          entry.player_id, entry.pet_id, snap, 'race', p_race_id, null, 'veteran', 'veteran_',
          veteran, array[1, 5, 15], array['bronze', 'silver', 'gold'], cfg.config_version
        );
        granted := granted || extra;
      end if;

      lifetime := public.award_add_progress(entry.player_id, null, 'lifetime_wins', 1);
      extra := public.award_grant_thresholds(
        entry.player_id, null, snap, 'race', p_race_id, null, 'lifetime', 'lifetime_wins_',
        lifetime, array[100, 500, 1000], array['bronze', 'silver', 'gold'], cfg.config_version
      );
      granted := granted || extra;

      streak := public.award_add_progress(entry.player_id, entry.pet_id, 'win_streak', 1);
      if streak >= 5 then
        new_id := public.award_try_insert(
          entry.player_id, entry.pet_id, 'feat_win_streak', snap, 'race', p_race_id, null, null, cfg.config_version
        );
        if new_id is not null then granted := granted || new_id; end if;
      end if;

      select min(e.finish_ms) into second_ms
      from public.race_entries e
      where e.race_id = p_race_id and e.status = 'finished' and e.id <> entry.id and e.finish_ms is not null;
      if second_ms is not null and (second_ms - entry.finish_ms) < 100 then
        new_id := public.award_try_insert(
          entry.player_id, entry.pet_id, 'feat_photo_finish', snap, 'race', p_race_id, null, null, cfg.config_version
        );
        if new_id is not null then granted := granted || new_id; end if;
      end if;

      if ev.event_type = 'hurdles' and race.class = 'championship' and coalesce(entry.hurdles_missed, -1) = 0 then
        new_id := public.award_try_insert(
          entry.player_id, entry.pet_id, 'feat_flawless', snap, 'race', p_race_id, null, null, cfg.config_version
        );
        if new_id is not null then granted := granted || new_id; end if;
      end if;
      if entry.halfway_place is not null and field_size > 1 and entry.halfway_place = field_size then
        new_id := public.award_try_insert(
          entry.player_id, entry.pet_id, 'feat_comeback', snap, 'race', p_race_id, null, null, cfg.config_version
        );
        if new_id is not null then granted := granted || new_id; end if;
      end if;
      if ev.event_type = 'trickShow' and entry.trick_seq_len is not null and coalesce(entry.trick_misses, -1) = 0 then
        new_id := public.award_try_insert(
          entry.player_id, entry.pet_id, 'feat_perfect_recall', snap, 'race', p_race_id, null, null, cfg.config_version
        );
        if new_id is not null then granted := granted || new_id; end if;
      end if;
    else
      perform public.award_set_progress(entry.player_id, entry.pet_id, 'win_streak', 0);
      if classed and race.class = 'championship' then
        perform public.award_set_progress(entry.player_id, entry.pet_id, 'champ_streak:' || ev.event_type, 0);
      end if;
    end if;

    pb_key := case
      when classed then 'personal_best:' || ev.event_type || ':' || ribbon_class
      else 'personal_best:' || ev.event_type
    end;
    pb := public.award_progress_value(entry.player_id, entry.pet_id, pb_key);
    if pb is null then
      perform public.award_set_progress(entry.player_id, entry.pet_id, pb_key, entry.finish_ms);
    elsif entry.finish_ms < pb then
      perform public.award_set_progress(entry.player_id, entry.pet_id, pb_key, entry.finish_ms);
      new_id := public.award_try_insert(
        entry.player_id, entry.pet_id, 'feat_personal_best', snap, 'race', p_race_id, null, null, cfg.config_version
      );
      if new_id is not null then granted := granted || new_id; end if;
    end if;

    extra := public.award_lifetime_collector(entry.player_id, cfg.config_version);
    granted := granted || extra;
  end loop;

  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.earned_at)
    from public.awards a
    where a.id = any (granted)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.award_record_look_pieces(p_pet uuid, p_theme text, p_submission uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  piece jsonb;
  pieces jsonb;
begin
  for pieces in
    select case
      when jsonb_typeof(l.pieces) = 'array' then l.pieces
      when jsonb_typeof(l.pieces->'pieces') = 'array' then l.pieces->'pieces'
      else '[]'::jsonb
    end
    from public.runway_looks l
    where l.submission_id = p_submission
  loop
    for piece in select value from jsonb_array_elements(pieces) loop
      if coalesce(piece->>'id', '') <> '' then
        insert into public.runway_pieces_worn (pet_id, theme_id, piece_id)
        values (p_pet, p_theme, piece->>'id')
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.award_check_full_rack(p_pet uuid, p_theme text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) > 0 and count(*) filter (
    where exists (
      select 1 from public.runway_pieces_worn w
      where w.pet_id = p_pet and w.theme_id = p_theme and w.piece_id = c.id
    )
  ) = count(*)
  from public.runway_theme_rack r
  join public.runway_costumes c on c.id = r.costume_id
  where r.theme_id = p_theme and c.theme_specific;
$$;

create or replace function public.award_check_lookbook(p_player uuid, p_pet uuid, p_snapshot jsonb, p_show uuid, p_version int)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  granted uuid[] := '{}';
  new_id uuid;
  themes text[] := array['space', 'sea', 'royal', 'beach', 'winter', 'rock', 'garden', 'spooky', 'west', 'hero', 'pirate', 'safari'];
  theme text;
  debuts int := 0;
  silvers int := 0;
  golds int := 0;
  has_debut boolean;
  has_encore boolean;
  has_party boolean;
  has_rack boolean;
begin
  foreach theme in array themes loop
    has_debut := exists (
      select 1 from public.awards where pet_id = p_pet and award_definition_id = 'stamp_' || theme || '_debut'
    );
    has_encore := exists (
      select 1 from public.awards where pet_id = p_pet and award_definition_id = 'stamp_' || theme || '_encore'
    );
    has_party := exists (
      select 1 from public.awards where pet_id = p_pet and award_definition_id = 'stamp_' || theme || '_party'
    );
    has_rack := exists (
      select 1 from public.awards where pet_id = p_pet and award_definition_id = 'stamp_' || theme || '_rack'
    );
    if has_debut then debuts := debuts + 1; end if;
    if has_debut and has_encore and has_party then silvers := silvers + 1; end if;
    if has_debut and has_encore and has_party and has_rack then golds := golds + 1; end if;
  end loop;
  if debuts = array_length(themes, 1) then
    new_id := public.award_try_insert(p_player, p_pet, 'lookbook_bronze', p_snapshot, 'runway', null, p_show, null, p_version);
    if new_id is not null then granted := granted || new_id; end if;
  end if;
  if silvers = array_length(themes, 1) then
    new_id := public.award_try_insert(p_player, p_pet, 'lookbook_silver', p_snapshot, 'runway', null, p_show, null, p_version);
    if new_id is not null then granted := granted || new_id; end if;
  end if;
  if golds = array_length(themes, 1) then
    new_id := public.award_try_insert(p_player, p_pet, 'lookbook_gold', p_snapshot, 'runway', null, p_show, null, p_version);
    if new_id is not null then granted := granted || new_id; end if;
  end if;
  return granted;
end;
$$;

create or replace function public.award_walk_pet(
  p_show uuid,
  p_theme text,
  p_player uuid,
  p_pet uuid,
  p_snapshot jsonb,
  p_submission uuid,
  p_friend boolean,
  p_local_day text,
  p_version int
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  granted uuid[] := '{}';
  extra uuid[];
  new_id uuid;
  counted boolean := true;
  day_count numeric;
  walked numeric;
  theme_walked numeric;
  shows numeric;
begin
  if p_pet is null or p_player is null then
    return granted;
  end if;
  if exists (select 1 from public.pets where id = p_pet and status = 'retired') and p_player is null then
    return granted;
  end if;

  perform public.award_record_look_pieces(p_pet, p_theme, p_submission);

  if not p_friend then
    day_count := public.award_add_progress(p_player, p_pet, 'solo_shows_on:' || p_local_day, 1);
    counted := day_count <= 3;
  end if;

  new_id := public.award_try_insert(
    p_player, p_pet, 'stamp_' || p_theme || '_debut', p_snapshot, 'runway', null, p_show, null, p_version
  );
  if new_id is not null then granted := granted || new_id; end if;

  if counted then
    walked := public.award_add_progress(p_player, p_pet, 'shows_walked', 1);
    theme_walked := public.award_add_progress(p_player, p_pet, 'shows_walked:' || p_theme, 1);
    extra := public.award_grant_thresholds(
      p_player, p_pet, p_snapshot, 'runway', null, p_show, 'covers', 'cover_',
      walked, array[5, 15, 40, 100], array['bronze', 'silver', 'gold', 'platinum'], p_version
    );
    granted := granted || extra;
    if theme_walked >= 5 then
      new_id := public.award_try_insert(
        p_player, p_pet, 'stamp_' || p_theme || '_encore', p_snapshot, 'runway', null, p_show, null, p_version
      );
      if new_id is not null then granted := granted || new_id; end if;
    end if;
    shows := public.award_add_progress(p_player, null, 'lifetime_shows', 1);
    extra := public.award_grant_thresholds(
      p_player, null, p_snapshot, 'runway', null, p_show, 'lifetime', 'lifetime_shows_',
      shows, array[50, 200, 500], array['bronze', 'silver', 'gold'], p_version
    );
    granted := granted || extra;
  end if;

  if p_friend then
    new_id := public.award_try_insert(
      p_player, p_pet, 'stamp_' || p_theme || '_party', p_snapshot, 'runway', null, p_show, null, p_version
    );
    if new_id is not null then granted := granted || new_id; end if;
  end if;

  if public.award_check_full_rack(p_pet, p_theme) then
    new_id := public.award_try_insert(
      p_player, p_pet, 'stamp_' || p_theme || '_rack', p_snapshot, 'runway', null, p_show, null, p_version
    );
    if new_id is not null then granted := granted || new_id; end if;
  end if;

  extra := public.award_check_lookbook(p_player, p_pet, p_snapshot, p_show, p_version);
  granted := granted || extra;
  extra := public.award_lifetime_collector(p_player, p_version);
  granted := granted || extra;
  return granted;
end;
$$;

create or replace function public.grant_runway_awards(p_show_id uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.awards_config%rowtype;
  showrow public.runway_shows%rowtype;
  granted uuid[] := '{}';
  extra uuid[];
  new_id uuid;
  local_day text;
  actor uuid;
  petrow public.pets%rowtype;
  snap jsonb;
  sub public.runway_submissions%rowtype;
  other uuid;
  friend_n numeric;
  hosted numeric;
  front numeric;
  max_votes int;
  pet_id uuid;
begin
  select * into cfg from public.awards_config where id = 1;
  select * into showrow from public.runway_shows where id = p_show_id;
  if not found then
    return '[]'::jsonb;
  end if;
  local_day := coalesce(p_payload->>'local_day', to_char(timezone('utc', now()), 'YYYY-MM-DD'));
  actor := coalesce((p_payload->>'player_id')::uuid, auth.uid());

  if p_event in ('solo_walked', 'friend_walked') then
    for sub in select * from public.runway_submissions where show_id = p_show_id and player_id is not null loop
      pet_id := coalesce((sub.pet_snapshot->>'id')::uuid, (sub.pet_snapshot->>'petId')::uuid);
      if pet_id is null then
        select id into pet_id from public.pets where owner_user_id = sub.player_id and status = 'active' limit 1;
      end if;
      select * into petrow from public.pets where id = pet_id;
      snap := coalesce(sub.pet_snapshot, public.award_doc_snapshot(petrow));
      extra := public.award_walk_pet(
        p_show_id, showrow.theme_id, sub.player_id, pet_id, snap, sub.id,
        p_event = 'friend_walked', local_day, cfg.config_version
      );
      granted := granted || extra;

      if p_event = 'friend_walked' then
        for other in
          select distinct s.player_id from public.runway_submissions s
          where s.show_id = p_show_id and s.player_id is not null and s.player_id <> sub.player_id
        loop
          perform public.award_set_progress(sub.player_id, pet_id, 'runway_friend:' || other::text, 1);
        end loop;
        select count(*) into friend_n
        from public.award_progress
        where player_id = sub.player_id and pet_id is not distinct from pet_id and counter_key like 'runway_friend:%';
        extra := public.award_grant_thresholds(
          sub.player_id, pet_id, snap, 'runway', null, p_show_id, 'friends', 'friend_crew_',
          friend_n, array[3, 10, 25], array['bronze', 'silver', 'gold'], cfg.config_version
        );
        granted := granted || extra;
      end if;
    end loop;

    if p_event = 'friend_walked'
      and (select count(*) from public.runway_submissions where show_id = p_show_id and player_id is not null and player_id <> showrow.host_player_id) >= 1
    then
      select * into petrow from public.pets where owner_user_id = showrow.host_player_id and status = 'active' limit 1;
      if found then
        snap := public.award_doc_snapshot(petrow);
        hosted := public.award_add_progress(showrow.host_player_id, petrow.id, 'hosted', 1);
        extra := public.award_grant_thresholds(
          showrow.host_player_id, petrow.id, snap, 'runway', null, p_show_id, 'friends', 'friend_host_',
          hosted, array[1, 5, 15], array['bronze', 'silver', 'gold'], cfg.config_version
        );
        granted := granted || extra;
      end if;
    end if;
  elsif p_event = 'vote_cast' then
    if actor is null then
      return '[]'::jsonb;
    end if;
    if coalesce(public.award_progress_value(actor, null, 'voted:' || p_show_id::text), 0) >= 1 then
      return '[]'::jsonb;
    end if;
    perform public.award_set_progress(actor, null, 'voted:' || p_show_id::text, 1);
    select * into petrow from public.pets
    where owner_user_id = actor and status = 'active'
    limit 1;
    if not found then
      return '[]'::jsonb;
    end if;
    snap := public.award_doc_snapshot(petrow);
    front := public.award_add_progress(actor, petrow.id, 'front_row', 1);
    extra := public.award_grant_thresholds(
      actor, petrow.id, snap, 'runway', null, p_show_id, 'friends', 'friend_front_',
      front, array[10, 30, 75], array['bronze', 'silver', 'gold'], cfg.config_version
    );
    granted := granted || extra;
  elsif p_event = 'results_published' then
    select coalesce(max(c), 0) into max_votes
    from (
      select count(*) as c from public.runway_votes where show_id = p_show_id group by contestant_submission_id
    ) t;
    if max_votes < 1 then
      return '[]'::jsonb;
    end if;
    for sub in
      select s.*
      from public.runway_submissions s
      join (
        select contestant_submission_id, count(*) as c
        from public.runway_votes
        where show_id = p_show_id
        group by contestant_submission_id
      ) v on v.contestant_submission_id = s.id
      where s.show_id = p_show_id and s.player_id is not null and v.c = max_votes
    loop
      pet_id := coalesce((sub.pet_snapshot->>'id')::uuid, (sub.pet_snapshot->>'petId')::uuid);
      if pet_id is null then
        select id into pet_id from public.pets where owner_user_id = sub.player_id and status = 'active' limit 1;
      end if;
      snap := coalesce(sub.pet_snapshot, '{}'::jsonb);
      new_id := public.award_try_insert(
        sub.player_id, pet_id, 'crowd_favorite', snap, 'runway', null, p_show_id, null, cfg.config_version
      );
      if new_id is not null then granted := granted || new_id; end if;
      new_id := public.award_try_insert(
        sub.player_id, pet_id, 'stamp_' || showrow.theme_id || '_star', snap, 'runway', null, p_show_id, null, cfg.config_version
      );
      if new_id is not null then granted := granted || new_id; end if;
    end loop;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.earned_at)
    from public.awards a
    where a.id = any (granted)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.award_add_progress(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.award_set_progress(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.award_progress_value(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.award_pet_snapshot(public.race_entries, public.pets) from public, anon, authenticated;
revoke all on function public.award_doc_snapshot(public.pets) from public, anon, authenticated;
revoke all on function public.award_try_insert(uuid, uuid, text, jsonb, text, uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function public.award_grant_thresholds(uuid, uuid, jsonb, text, uuid, uuid, text, text, numeric, int[], text[], int) from public, anon, authenticated;
revoke all on function public.award_lifetime_collector(uuid, int) from public, anon, authenticated;
revoke all on function public.grant_race_awards(uuid) from public, anon, authenticated;
revoke all on function public.award_record_look_pieces(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.award_check_full_rack(uuid, text) from public, anon, authenticated;
revoke all on function public.award_check_lookbook(uuid, uuid, jsonb, uuid, int) from public, anon, authenticated;
revoke all on function public.award_walk_pet(uuid, text, uuid, uuid, jsonb, uuid, boolean, text, int) from public, anon, authenticated;
revoke all on function public.grant_runway_awards(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.grant_race_awards(uuid) to service_role;
grant execute on function public.grant_runway_awards(uuid, text, jsonb) to service_role;

