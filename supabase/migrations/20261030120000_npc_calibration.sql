-- NPC calibration: one row per real finish, a skill grid per event x class x config
-- version, and a solo win-rate offset. Fill time still writes the spread skill.
-- When a curve exists and the offset is not zero, or the curve is data-backed,
-- that skill is remapped before the phone and the replay read it.
--
-- Optional backstop: enable pg_cron, then once a day POST the npc_calibrate edge
-- function with the service role key and body {"action":"run"}.

create table public.race_results (
  id bigint generated always as identity primary key,
  race_id uuid not null references public.races (id) on delete cascade,
  pet_id uuid not null,
  player_id uuid not null,
  event text not null,
  class text not null,
  config_version text not null,
  is_solo boolean not null,
  metric numeric not null,
  metric_adj numeric not null,
  metric_kind text not null check (metric_kind in ('time', 'distance')),
  created_at timestamptz not null default now(),
  unique (race_id, player_id)
);

create index race_results_window_idx
  on public.race_results (event, class, config_version, created_at);

create table public.npc_calibration (
  event text not null,
  class text not null,
  config_version text not null,
  curve jsonb not null,
  n_runs int not null default 0,
  n_players int not null default 0,
  metric_kind text not null check (metric_kind in ('time', 'distance')),
  status text not null default 'default' check (status in ('default', 'active')),
  computed_at timestamptz not null default now(),
  primary key (event, class, config_version)
);

create table public.npc_calibration_grid (
  event text not null,
  class text not null,
  config_version text not null,
  skill_step smallint not null check (skill_step between 0 and 20),
  metric numeric not null,
  primary key (event, class, config_version, skill_step)
);

create table public.npc_difficulty (
  event text not null,
  class text not null,
  config_version text not null,
  skill_offset numeric not null default 0,
  frozen boolean not null default false,
  manual boolean not null default false,
  solo_win_rate numeric,
  solo_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (event, class, config_version),
  constraint npc_difficulty_offset check (skill_offset >= -0.15 and skill_offset <= 0.15)
);

alter table public.race_results enable row level security;
alter table public.npc_calibration enable row level security;
alter table public.npc_calibration_grid enable row level security;
alter table public.npc_difficulty enable row level security;

revoke all on table public.race_results, public.npc_calibration, public.npc_calibration_grid, public.npc_difficulty
  from public, anon, authenticated;
grant all on table public.race_results, public.npc_calibration, public.npc_calibration_grid, public.npc_difficulty
  to service_role;

-- Spread skill plus offset, read on the performance curve, inverted through the grid.
-- A default curve with offset 0 never calls this: fill leaves the spread skill alone.
create or replace function public.stadium_resolve_npc_skill(
  p_event text,
  p_class text,
  p_version text,
  p_spread numeric,
  p_offset numeric,
  p_kind text,
  p_curve jsonb
) returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  adjusted numeric;
  pos numeric;
  lo int;
  hi int;
  target numeric;
  left_step int;
  left_metric numeric;
  right_step int;
  right_metric numeric;
  span numeric;
  grid_count int;
begin
  select count(*) into grid_count
  from public.npc_calibration_grid g
  where g.event = p_event and g.class = p_class and g.config_version = p_version;
  if grid_count < 21 or p_curve is null or jsonb_typeof(p_curve) <> 'array' or jsonb_array_length(p_curve) < 21 then
    return p_spread;
  end if;

  adjusted := greatest(0.10, least(0.90, coalesce(p_spread, 0.5) + coalesce(p_offset, 0)));
  pos := adjusted * 20;
  lo := floor(pos)::int;
  hi := ceil(pos)::int;
  if lo = hi then
    target := (p_curve->>lo)::numeric;
  else
    span := pos - lo;
    target := (p_curve->>lo)::numeric
      + (((p_curve->>hi)::numeric - (p_curve->>lo)::numeric) * span);
  end if;

  if p_kind = 'time' then
    select g.skill_step, g.metric into left_step, left_metric
    from public.npc_calibration_grid g
    where g.event = p_event and g.class = p_class and g.config_version = p_version
      and g.metric >= target
    order by g.skill_step desc
    limit 1;
  else
    select g.skill_step, g.metric into left_step, left_metric
    from public.npc_calibration_grid g
    where g.event = p_event and g.class = p_class and g.config_version = p_version
      and g.metric <= target
    order by g.skill_step desc
    limit 1;
  end if;

  if left_step is null then
    select g.skill_step into left_step
    from public.npc_calibration_grid g
    where g.event = p_event and g.class = p_class and g.config_version = p_version
    order by g.skill_step asc
    limit 1;
    return left_step / 20.0;
  end if;

  select g.skill_step, g.metric into right_step, right_metric
  from public.npc_calibration_grid g
  where g.event = p_event and g.class = p_class and g.config_version = p_version
    and g.skill_step > left_step
  order by g.skill_step asc
  limit 1;

  if right_step is null or right_metric = left_metric then
    return left_step / 20.0;
  end if;

  span := (target - left_metric) / (right_metric - left_metric);
  return (left_step / 20.0) + ((right_step - left_step) / 20.0) * span;
end;
$$;

create or replace function public.stadium_apply_npc_calibration(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev text;
  cls text;
  ver text;
  cal_status text;
  cal_kind text;
  cal_curve jsonb;
  cal_offset numeric;
  entry record;
  sim numeric;
begin
  select evnt.event_type, r.class, r.config_version
    into ev, cls, ver
  from public.races r
  join public.competition_events evnt on evnt.id = r.event_id
  where r.id = p_race_id;
  if ev is null then
    return;
  end if;

  select c.status, c.metric_kind, c.curve, coalesce(d.skill_offset, 0)
    into cal_status, cal_kind, cal_curve, cal_offset
  from public.npc_calibration c
  left join public.npc_difficulty d
    on d.event = c.event and d.class = c.class and d.config_version = c.config_version
  where c.event = ev and c.class = cls and c.config_version = ver;

  if cal_status is null or (cal_status = 'default' and cal_offset = 0) then
    return;
  end if;

  for entry in
    select id, skill
    from public.race_entries
    where race_id = p_race_id and is_npc and skill is not null
  loop
    sim := public.stadium_resolve_npc_skill(ev, cls, ver, entry.skill, cal_offset, cal_kind, cal_curve);
    update public.race_entries set skill = sim where id = entry.id;
  end loop;
end;
$$;

-- Solo races in the window: one real account, at least one NPC, not a friend game.
-- A finish with no time is a DNF and counts as a loss.
create or replace function public.npc_solo_stats(p_since timestamptz)
returns table (
  event text,
  class text,
  config_version text,
  solos int,
  wins int
)
language sql
stable
security definer
set search_path = public
as $$
  with solo as (
    select r.id, evnt.event_type as event, r.class, r.config_version
    from public.races r
    join public.competition_events evnt on evnt.id = r.event_id
    where r.status = 'finished'
      and evnt.cup <> 'friends'
      and coalesce(r.started_at, r.created_at) >= p_since
      and exists (
        select 1 from public.race_entries npc
        where npc.race_id = r.id and npc.is_npc
      )
      and (
        select count(*)
        from public.race_entries human
        join auth.users account on account.id = human.player_id
        where human.race_id = r.id
          and not human.is_npc
          and human.status = 'finished'
          and coalesce(account.is_anonymous, false) = false
      ) = 1
  )
  select
    solo.event,
    solo.class,
    solo.config_version,
    count(*)::int as solos,
    count(*) filter (
      where exists (
        select 1 from public.race_entries human
        where human.race_id = solo.id
          and not human.is_npc
          and human.status = 'finished'
          and human.finish_ms is not null
          and human.place = 1
      )
    )::int as wins
  from solo
  group by solo.event, solo.class, solo.config_version;
$$;

revoke all on function public.stadium_resolve_npc_skill(text, text, text, numeric, numeric, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.stadium_apply_npc_calibration(uuid)
  from public, anon, authenticated;
revoke all on function public.npc_solo_stats(timestamptz)
  from public, anon, authenticated;
grant execute on function public.stadium_resolve_npc_skill(text, text, text, numeric, numeric, text, jsonb) to service_role;
grant execute on function public.stadium_apply_npc_calibration(uuid) to service_role;
grant execute on function public.npc_solo_stats(timestamptz) to service_role;

create or replace function public.stadium_fill_npcs(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  race public.races%rowtype;
  names text[] := array['Pip', 'Nori', 'Biscuit', 'Miso', 'Pebble', 'Waffles', 'Mochi', 'Clover'];
  dogs text[] := array['retriever', 'corgi', 'dachshund', 'husky', 'pug'];
  cats text[] := array['domesticShorthair', 'siamese', 'persian', 'maineCoon', 'scottishFold'];
  coats text[] := array['#F2C48D', '#E7E2DC', '#C9A27A', '#8E6246', '#D6B4A0', '#F6D7A8'];
  i int;
  open_lane int;
  skill numeric;
  species text;
  start int;
begin
  if exists (select 1 from public.race_entries where race_id = p_race_id and is_npc) then
    return;
  end if;
  select * into cfg from public.stadium_config where id = 1;
  select * into race from public.races where id = p_race_id;
  start := abs(hashtext(coalesce(race.seed, p_race_id::text)));
  for i in 1 .. cfg.npc_fill loop
    select min(g.n) into open_lane
    from generate_series(1, race.capacity) as g(n)
    where not exists (
      select 1 from public.race_entries x
      where x.race_id = p_race_id and x.lane = g.n and x.status in ('signed_up', 'checked_in', 'finished')
    );
    exit when open_lane is null;
    species := case when (start + i) % 2 = 0 then 'dog' else 'cat' end;
    skill := greatest(0.05, least(0.95, ((i - 0.5) / cfg.npc_fill) + ((abs(hashtext(race.seed || ':' || i::text)) % 17) - 8) / 100.0));
    insert into public.race_entries (
      race_id, pet_id, player_id, lane, status, pet_name, pet_level, species, breed_id, is_npc, skill, coat, modifiers
    ) values (
      p_race_id,
      null,
      null,
      open_lane,
      'checked_in',
      names[1 + (start + i) % array_length(names, 1)],
      1,
      species,
      case when species = 'dog'
        then dogs[1 + (start + i) % array_length(dogs, 1)]
        else cats[1 + (start + i) % array_length(cats, 1)]
      end,
      true,
      skill,
      jsonb_build_object('coat', coats[1 + (start + i) % array_length(coats, 1)]),
      jsonb_build_object('energy', 80, 'mood', 60, 'stamina', 40, 'agility', 40, 'intelligence', 40)
    );
  end loop;
  perform public.stadium_apply_npc_calibration(p_race_id);
end;
$$;
