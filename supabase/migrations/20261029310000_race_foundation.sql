-- Race foundation: new events, Veteran Cup, race seed, modifier snapshots, class merge,
-- NPC rows, and submit_race_report. Apply after 20261029200000_stadium.sql.
-- The owner applies this. Do not run it against the hosted project from an agent.

insert into public.stadium_classes (id, min_level) values ('veteran', 0)
on conflict (id) do nothing;

alter table public.stadium_config
  add column if not exists countdown_seconds int not null default 3,
  add column if not exists report_wait_seconds int not null default 10,
  add column if not exists merge_classes boolean not null default true;

delete from public.competition_events
where event_type in ('fetchSwat', 'hoopHop', 'tunnelRun');

alter table public.competition_events drop constraint if exists competition_events_event_type_check;
alter table public.competition_events drop constraint if exists competition_events_slot_id_event_type_key;

alter table public.competition_events
  add column if not exists cup text not null default 'open',
  add column if not exists required_tricks text[] not null default '{}';

alter table public.competition_events
  add constraint competition_events_event_type_check
    check (event_type in ('funRun', 'dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle')),
  add constraint competition_events_cup_check check (cup in ('open', 'veteran')),
  add constraint competition_events_slot_event_cup_key unique (slot_id, event_type, cup);

alter table public.races drop constraint if exists races_status_check;
alter table public.races
  add constraint races_status_check
    check (status in ('open', 'locked', 'countdown', 'running', 'finished', 'cancelled'));

alter table public.races
  add column if not exists seed text not null default '',
  add column if not exists config_version text not null default 'funrun-1',
  add column if not exists first_report_at timestamptz;

update public.races set seed = substr(md5(id::text), 1, 16) where seed = '';

alter table public.race_entries alter column pet_id drop not null;
alter table public.race_entries alter column player_id drop not null;
alter table public.race_entries
  add column if not exists is_npc boolean not null default false,
  add column if not exists skill numeric,
  add column if not exists coat jsonb,
  add column if not exists modifiers jsonb,
  add column if not exists finish_ms int,
  add column if not exists place int;

alter table public.race_entries drop constraint if exists race_entries_actor;
alter table public.race_entries
  add constraint race_entries_actor check (
    (is_npc and pet_id is null and player_id is null)
    or (not is_npc and pet_id is not null and player_id is not null)
  );

alter table public.pet_race_state add column if not exists event_type text;
update public.pet_race_state set event_type = 'funRun' where event_type is null;
alter table public.pet_race_state drop constraint if exists pet_race_state_pkey;
alter table public.pet_race_state alter column event_type set not null;
alter table public.pet_race_state add primary key (pet_id, event_type);

-- pets.doc keys this reads: needs.energy, needs.happiness,
-- attributes.current.stamina, attributes.current.agility, attributes.current.intelligence.
create or replace function public.stadium_modifier_snapshot(p_doc jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'energy', coalesce((p_doc->'needs'->>'energy')::numeric, 0),
    'mood', coalesce((p_doc->'needs'->>'happiness')::numeric, 0),
    'stamina', coalesce((p_doc->'attributes'->'current'->>'stamina')::numeric, 0),
    'agility', coalesce((p_doc->'attributes'->'current'->>'agility')::numeric, 0),
    'intelligence', coalesce((p_doc->'attributes'->'current'->>'intelligence')::numeric, 0)
  );
$$;

comment on function public.stadium_modifier_snapshot(jsonb) is
  'Snapshot keys: needs.energy, needs.happiness, attributes.current.stamina, attributes.current.agility, attributes.current.intelligence.';

create or replace function public.stadium_age_days(p_doc jsonb)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_doc->>'agingCalendar', '') = 'month'
      then coalesce((p_doc->>'ageDays')::numeric, 0)
    else coalesce((p_doc->>'ageDays')::numeric, 0) * (22.0 / 180.0)
  end;
$$;

create or replace function public.stadium_is_senior(p_doc jsonb)
returns boolean
language sql
immutable
as $$
  select public.stadium_age_days(p_doc) >= 22;
$$;

create or replace function public.stadium_trick_id(p_species text, p_key text)
returns text
language sql
immutable
as $$
  select case when p_key in ('sit', 'speak') then p_key else p_species || '_' || p_key end;
$$;

create or replace function public.stadium_required_tricks(p_event text)
returns text[]
language sql
immutable
as $$
  select case p_event
    when 'trickShow' then array['sit', 'speak', 'spin', 'stand_tall']
    when 'hurdles' then array['hurdle']
    when 'weave' then array['weave']
    when 'obstacle' then array['hurdle', 'tunnel']
    else array[]::text[]
  end;
$$;

create or replace function public.stadium_class(p_level int)
returns text
language sql
stable
set search_path = public
as $$
  select id from public.stadium_classes
  where id <> 'veteran' and min_level <= greatest(1, coalesce(p_level, 1))
  order by min_level desc
  limit 1;
$$;

create or replace function public.ensure_slots()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  first_id bigint;
  slot bigint;
  open_one text;
  other_one text;
  veteran_event text;
begin
  select * into cfg from public.stadium_config where id = 1;
  first_id := floor(extract(epoch from now()) / cfg.slot_seconds)::bigint + 1;
  for slot in first_id .. first_id + cfg.slots_shown loop
    insert into public.competition_slots (id, starts_at)
    values (slot, to_timestamp(slot * cfg.slot_seconds))
    on conflict (id) do nothing;

    open_one := case when slot % 2 = 0 then 'dockDive' else 'sniffOut' end;
    other_one := (array['trickShow', 'hurdles', 'weave', 'obstacle'])[1 + (slot % 4)];

    insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort) values
      (slot, 'funRun', 'both', public.stadium_required_tricks('funRun'), 'open', 0),
      (slot, open_one, 'both', public.stadium_required_tricks(open_one), 'open', 1),
      (slot, other_one, 'both', public.stadium_required_tricks(other_one), 'open', 2)
    on conflict (slot_id, event_type, cup) do nothing;

    if slot % 3 = 0 then
      veteran_event := (array['funRun', 'dockDive', 'sniffOut', 'funRun', 'hurdles'])[1 + ((slot / 3) % 5)];
      insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
      values (slot, veteran_event, 'both', public.stadium_required_tricks(veteran_event), 'veteran', 3)
      on conflict (slot_id, event_type, cup) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.stadium_merge_classes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  pair record;
  low_id uuid;
  high_id uuid;
  low_n int;
  high_n int;
begin
  select * into cfg from public.stadium_config where id = 1;
  if not coalesce(cfg.merge_classes, true) then
    return;
  end if;
  for pair in
    select ev.id as event_id, neighbors.low_class, neighbors.high_class
    from public.competition_events ev
    join public.competition_slots s on s.id = ev.slot_id
    cross join (values
      ('beginner', 'novice'),
      ('novice', 'open'),
      ('open', 'expert'),
      ('expert', 'championship')
    ) as neighbors(low_class, high_class)
    where ev.cup = 'open'
      and s.starts_at - make_interval(secs => cfg.gate_open_seconds) <= now()
      and s.starts_at - make_interval(secs => cfg.lock_seconds) > now()
  loop
    select r.id into low_id from public.races r
    where r.event_id = pair.event_id and r.class = pair.low_class and r.status = 'open'
    order by r.created_at limit 1;
    select r.id into high_id from public.races r
    where r.event_id = pair.event_id and r.class = pair.high_class and r.status = 'open'
    order by r.created_at limit 1;
    if low_id is null or high_id is null then
      continue;
    end if;
    select count(*) into low_n from public.race_entries
    where race_id = low_id and status in ('signed_up', 'checked_in');
    select count(*) into high_n from public.race_entries
    where race_id = high_id and status in ('signed_up', 'checked_in');
    if low_n + high_n = 0 or low_n + high_n > cfg.capacity then
      continue;
    end if;
    if low_n <> 1 and high_n <> 1 then
      continue;
    end if;
    with moving as (
      select id, row_number() over (order by lane) as n
      from public.race_entries
      where race_id = high_id and status in ('signed_up', 'checked_in')
    ),
    free as (
      select g.n as lane, row_number() over (order by g.n) as n
      from generate_series(1, cfg.capacity) as g(n)
      where not exists (
        select 1 from public.race_entries x
        where x.race_id = low_id and x.lane = g.n and x.status in ('signed_up', 'checked_in', 'finished')
      )
    )
    update public.race_entries e
    set race_id = low_id, lane = free.lane
    from moving
    join free on free.n = moving.n
    where e.id = moving.id;
    delete from public.races r
    where r.id = high_id
      and not exists (select 1 from public.race_entries x where x.race_id = r.id);
  end loop;
end;
$$;

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
end;
$$;

create or replace function public.stadium_finish_cooldown(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  event_type text;
begin
  select * into cfg from public.stadium_config where id = 1;
  select ev.event_type into event_type
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where r.id = p_race_id;
  insert into public.pet_race_state (pet_id, event_type, cooldown_until)
  select e.pet_id, event_type, now() + make_interval(secs => cfg.cooldown_seconds)
  from public.race_entries e
  where e.race_id = p_race_id and not e.is_npc and e.status = 'finished' and e.pet_id is not null
  on conflict (pet_id, event_type) do update set cooldown_until = excluded.cooldown_until;
end;
$$;

create or replace function public.stadium_rank(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select e.id, row_number() over (order by e.finish_ms asc nulls last, e.signed_up_at) as place
    from public.race_entries e
    where e.race_id = p_race_id and e.status = 'finished'
  )
  update public.race_entries e
  set place = ranked.place
  from ranked
  where e.id = ranked.id;
  update public.races set status = 'finished' where id = p_race_id;
  perform public.stadium_finish_cooldown(p_race_id);
end;
$$;

create or replace function public.advance_races()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  r record;
  live int;
begin
  select * into cfg from public.stadium_config where id = 1;
  perform public.stadium_merge_classes();

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'open'
      and s.starts_at - make_interval(secs => cfg.lock_seconds) <= now()
    for update of races skip locked
  loop
    update public.race_entries e
    set modifiers = public.stadium_modifier_snapshot(p.doc)
    from public.pets p
    where e.race_id = r.id and e.pet_id = p.id and e.status in ('signed_up', 'checked_in') and e.modifiers is null;
    update public.race_entries
    set status = case
      when last_seen_at is not null and last_seen_at >= now() - make_interval(secs => cfg.presence_grace_seconds)
        then 'checked_in'
      else 'no_show'
    end
    where race_id = r.id and status in ('signed_up', 'checked_in');
    update public.races set status = 'locked' where id = r.id;
  end loop;

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'locked'
      and s.starts_at - make_interval(secs => cfg.countdown_seconds) <= now()
      and s.starts_at > now()
    for update of races skip locked
  loop
    update public.races set status = 'countdown' where id = r.id;
  end loop;

  for r in
    select races.id, ev.event_type, s.starts_at
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status in ('locked', 'countdown') and s.starts_at <= now()
    for update of races skip locked
  loop
    select count(*) into live
    from public.race_entries
    where race_id = r.id and status = 'checked_in' and not is_npc;
    if live = 0 then
      update public.races set status = 'cancelled', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if r.event_type <> 'funRun' then
      update public.race_entries set status = 'finished' where race_id = r.id and status = 'checked_in';
      update public.races set status = 'finished', started_at = r.starts_at where id = r.id;
      perform public.stadium_finish_cooldown(r.id);
      continue;
    end if;
    if live = 1 then
      perform public.stadium_fill_npcs(r.id);
    end if;
    update public.races
    set status = 'running', started_at = r.starts_at
    where id = r.id;
  end loop;
end;
$$;

create or replace function public.stadium_card_state(p_pet public.pets, p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  ev public.competition_events%rowtype;
  starts timestamptz;
  species text := public.stadium_species(p_pet.doc);
  active_event uuid;
  trick text;
begin
  select * into cfg from public.stadium_config where id = 1;
  select * into ev from public.competition_events where id = p_event_id;
  select starts_at into starts from public.competition_slots where id = ev.slot_id;

  select r.event_id into active_event
  from public.race_entries e join public.races r on r.id = e.race_id
  where e.pet_id = p_pet.id and e.status in ('signed_up', 'checked_in');
  if active_event = p_event_id then
    return 'entered';
  end if;
  if starts - make_interval(secs => cfg.lock_seconds) <= now() then
    return 'closed';
  end if;
  if ev.cup = 'veteran' and not public.stadium_is_senior(p_pet.doc) then
    return 'closed';
  end if;
  if ev.species_allowed <> 'both' and ev.species_allowed <> species then
    return 'wrong_species';
  end if;
  foreach trick in array ev.required_tricks loop
    if coalesce((p_pet.doc->'training'->public.stadium_trick_id(species, trick)->>'mastered')::boolean, false) = false then
      return 'missing_trick';
    end if;
  end loop;
  if exists (
    select 1 from public.pet_race_state
    where pet_id = p_pet.id and event_type = ev.event_type and cooldown_until > now()
  ) then
    return 'resting';
  end if;
  if active_event is not null then
    return 'busy';
  end if;
  return 'open';
end;
$$;

create or replace function public.get_upcoming_slots(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  pet public.pets%rowtype;
  species text;
  pet_class text;
  entry_id uuid;
  my_race uuid;
  slots jsonb;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  select * into cfg from public.stadium_config where id = 1;
  species := public.stadium_species(pet.doc);
  pet_class := public.stadium_class((pet.doc->>'level')::int);

  select e.id, e.race_id into entry_id, my_race from public.race_entries e
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in');

  select coalesce(jsonb_agg(slot_row order by slot_row->>'starts_at'), '[]'::jsonb) into slots
  from (
    select jsonb_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'events', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', ev.id,
          'event_type', ev.event_type,
          'species_allowed', ev.species_allowed,
          'cup', ev.cup,
          'required_trick', (
            select public.stadium_trick_id(species, trick)
            from unnest(ev.required_tricks) as trick
            where coalesce((pet.doc->'training'->public.stadium_trick_id(species, trick)->>'mastered')::boolean, false) = false
            limit 1
          ),
          'is_away', ev.is_away,
          'away_location', ev.away_location,
          'state', public.stadium_card_state(pet, ev.id),
          'signed_up', coalesce((
            select count(*) from public.race_entries e
            where e.race_id = coalesce(
              (select r.id from public.races r where r.id = my_race and r.event_id = ev.id),
              (
                select r.id from public.races r
                where r.event_id = ev.id
                  and r.class = case when ev.cup = 'veteran' then 'veteran' else pet_class end
                  and r.status = 'open'
                  and (select count(*) from public.race_entries x
                       where x.race_id = r.id and x.status in ('signed_up', 'checked_in')) < r.capacity
                order by r.created_at
                limit 1
              )
            )
            and e.status in ('signed_up', 'checked_in')
          ), 0)
        ) order by ev.sort), '[]'::jsonb)
        from public.competition_events ev
        where ev.slot_id = s.id
          and (ev.cup = 'open' or public.stadium_is_senior(pet.doc))
      )
    ) as slot_row
    from public.competition_slots s
    where s.starts_at > now()
    order by s.starts_at
    limit cfg.slots_shown
  ) shown;

  return jsonb_build_object(
    'server_now', now(),
    'config', jsonb_build_object(
      'slot_seconds', cfg.slot_seconds,
      'capacity', cfg.capacity,
      'gate_open_seconds', cfg.gate_open_seconds,
      'lock_seconds', cfg.lock_seconds,
      'cooldown_seconds', cfg.cooldown_seconds,
      'config_version', 'funrun-1'
    ),
    'class', pet_class,
    'species', species,
    'cooldown_until', null,
    'active_entry', case when entry_id is null then null else public.stadium_entry_json(entry_id) end,
    'slots', slots
  );
end;
$$;

create or replace function public.sign_up(p_pet_id uuid, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  pet public.pets%rowtype;
  ev public.competition_events%rowtype;
  uid uuid := auth.uid();
  card text;
  pet_class text;
  target uuid;
  free_lane int;
  new_entry uuid;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  perform pg_advisory_xact_lock(hashtext('stadium-pet:' || pet.id::text));
  select * into cfg from public.stadium_config where id = 1;
  select * into ev from public.competition_events where id = p_event_id;
  if not found then
    raise exception 'unknown event';
  end if;
  card := public.stadium_card_state(pet, p_event_id);
  if card = 'entered' then
    return public.stadium_entry_json(
      (select id from public.race_entries where pet_id = pet.id and status in ('signed_up', 'checked_in'))
    );
  end if;
  if card <> 'open' then
    raise exception '%', card;
  end if;

  pet_class := case when ev.cup = 'veteran' then 'veteran' else public.stadium_class((pet.doc->>'level')::int) end;
  perform pg_advisory_xact_lock(hashtext('stadium-race:' || p_event_id::text || ':' || pet_class));

  select r.id into target
  from public.races r
  where r.event_id = p_event_id and r.class = pet_class and r.status = 'open'
    and (select count(*) from public.race_entries x
         where x.race_id = r.id and x.status in ('signed_up', 'checked_in')) < r.capacity
  order by exists (
      select 1 from public.race_entries x
      join public.friendships f
        on (f.user_a_id = uid and f.user_b_id = x.player_id) or (f.user_b_id = uid and f.user_a_id = x.player_id)
      where x.race_id = r.id and x.status in ('signed_up', 'checked_in')
    ) desc,
    r.created_at
  limit 1;

  if target is null then
    insert into public.races (event_id, class, capacity, seed, config_version)
    values (
      p_event_id,
      pet_class,
      cfg.capacity,
      substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16),
      'funrun-1'
    )
    returning id into target;
  end if;

  select min(g.n) into free_lane
  from generate_series(1, cfg.capacity) as g(n)
  where not exists (
    select 1 from public.race_entries x
    where x.race_id = target and x.lane = g.n and x.status in ('signed_up', 'checked_in', 'finished')
  );

  insert into public.race_entries (race_id, pet_id, player_id, lane, pet_name, pet_level, species, breed_id, handle)
  values (
    target,
    pet.id,
    uid,
    free_lane,
    coalesce(pet.doc->>'name', 'Pet'),
    greatest(1, coalesce((pet.doc->>'level')::int, 1)),
    public.stadium_species(pet.doc),
    coalesce(pet.doc->>'breedId', ''),
    (select handle from public.profiles where user_id = uid)
  )
  returning id into new_entry;

  return public.stadium_entry_json(new_entry);
end;
$$;

create or replace function public.race_state(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.advance_races();
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.race_entries
    where race_id = p_race_id and player_id = auth.uid()
  ) then
    raise exception 'not in race';
  end if;
  select jsonb_build_object(
    'server_now', now(),
    'race_id', r.id,
    'status', r.status,
    'class', r.class,
    'event_type', ev.event_type,
    'cup', ev.cup,
    'starts_at', s.starts_at,
    'seed', r.seed,
    'config_version', r.config_version,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_id', e.id,
        'lane', e.lane,
        'pet_name', e.pet_name,
        'pet_level', e.pet_level,
        'species', e.species,
        'breed_id', e.breed_id,
        'handle', e.handle,
        'status', e.status,
        'mine', e.player_id = auth.uid(),
        'is_npc', e.is_npc,
        'skill', e.skill,
        'coat', e.coat,
        'modifiers', e.modifiers,
        'finish_ms', e.finish_ms,
        'place', e.place
      ) order by e.lane)
      from public.race_entries e
      where e.race_id = r.id and e.status in ('signed_up', 'checked_in', 'finished')
    ), '[]'::jsonb)
  ) into result
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  return result;
end;
$$;

create or replace function public.stadium_maybe_finalize(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  live_total int;
  reported int;
  first_at timestamptz;
  status text;
begin
  select * into cfg from public.stadium_config where id = 1;
  select races.status, races.first_report_at into status, first_at from public.races where id = p_race_id;
  if status = 'finished' or status = 'cancelled' then
    return;
  end if;
  select count(*) into live_total from public.race_entries
  where race_id = p_race_id and not is_npc and status in ('checked_in', 'finished');
  select count(*) into reported from public.race_entries
  where race_id = p_race_id and not is_npc and finish_ms is not null;
  if live_total > 1 and reported < live_total and (first_at is null or first_at + make_interval(secs => cfg.report_wait_seconds) > now()) then
    return;
  end if;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and not is_npc and status = 'checked_in' and finish_ms is null;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and is_npc and status = 'checked_in';
  perform public.stadium_rank(p_race_id);
end;
$$;

create or replace function public.submit_race_report(p_race_id uuid, p_finish_ms int, p_npc_finishes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
  npc jsonb;
begin
  perform public.advance_races();
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if (select status from public.races where id = p_race_id) = 'finished' then
    return public.race_state(p_race_id);
  end if;
  select id into entry_id from public.race_entries
  where race_id = p_race_id and player_id = auth.uid() and not is_npc and status = 'checked_in' and finish_ms is null;
  if entry_id is null then
    return public.race_state(p_race_id);
  end if;
  if p_finish_ms is null then
    update public.race_entries set status = 'finished', finish_ms = null where id = entry_id;
  else
    update public.race_entries set finish_ms = greatest(0, p_finish_ms), status = 'finished' where id = entry_id;
  end if;
  update public.races set first_report_at = coalesce(first_report_at, now()) where id = p_race_id;
  if jsonb_typeof(p_npc_finishes) = 'array' then
    for npc in select value from jsonb_array_elements(p_npc_finishes) loop
      if npc->>'finish_ms' is null then
        update public.race_entries
        set status = 'finished'
        where id = (npc->>'entry_id')::uuid and race_id = p_race_id and is_npc and finish_ms is null;
      else
        update public.race_entries
        set finish_ms = greatest(0, (npc->>'finish_ms')::int), status = 'finished'
        where id = (npc->>'entry_id')::uuid and race_id = p_race_id and is_npc and finish_ms is null;
      end if;
    end loop;
  end if;
  perform public.stadium_maybe_finalize(p_race_id);
  return public.race_state(p_race_id);
end;
$$;

alter table public.competition_events drop column if exists required_obstacle;

revoke all on function public.stadium_modifier_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.stadium_age_days(jsonb) from public, anon, authenticated;
revoke all on function public.stadium_is_senior(jsonb) from public, anon, authenticated;
revoke all on function public.stadium_trick_id(text, text) from public, anon, authenticated;
revoke all on function public.stadium_required_tricks(text) from public, anon, authenticated;
revoke all on function public.stadium_merge_classes() from public, anon, authenticated;
revoke all on function public.stadium_fill_npcs(uuid) from public, anon, authenticated;
revoke all on function public.stadium_finish_cooldown(uuid) from public, anon, authenticated;
revoke all on function public.stadium_rank(uuid) from public, anon, authenticated;
revoke all on function public.stadium_maybe_finalize(uuid) from public, anon, authenticated;
revoke all on function public.submit_race_report(uuid, int, jsonb) from public, anon;

grant execute on function public.submit_race_report(uuid, int, jsonb) to authenticated;
