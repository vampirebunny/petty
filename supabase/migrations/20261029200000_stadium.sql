-- Stadium: slot schedule, sign-ups, and the starting gate. The race itself is a later brief.
-- Apply after 20261029120000_second_wind_price.sql.
-- Every RPC below advances the schedule first, so no timer is required. Optional backstop:
-- enable pg_cron, then schedule `select public.stadium_tick();` every minute.

create table public.stadium_config (
  id int primary key,
  slot_seconds int not null,
  slots_shown int not null,
  capacity int not null,
  gate_open_seconds int not null,
  lock_seconds int not null,
  cooldown_seconds int not null,
  npc_fill int not null,
  presence_grace_seconds int not null,
  constraint stadium_config_singleton check (id = 1)
);

insert into public.stadium_config (
  id, slot_seconds, slots_shown, capacity, gate_open_seconds, lock_seconds, cooldown_seconds, npc_fill, presence_grace_seconds
) values (1, 300, 3, 6, 60, 10, 900, 5, 15);

create table public.stadium_classes (
  id text primary key,
  min_level int not null
);

insert into public.stadium_classes (id, min_level) values
  ('beginner', 1),
  ('novice', 10),
  ('open', 20),
  ('expert', 35),
  ('championship', 50);

-- The slot id is floor(epoch / slot_seconds) for its start time.
create table public.competition_slots (
  id bigint primary key,
  starts_at timestamptz not null unique
);

create table public.competition_events (
  id uuid primary key default gen_random_uuid(),
  slot_id bigint not null references public.competition_slots (id) on delete cascade,
  event_type text not null check (event_type in ('fetchSwat', 'funRun', 'hoopHop', 'tunnelRun')),
  species_allowed text not null check (species_allowed in ('dog', 'cat', 'both')),
  required_obstacle text check (required_obstacle in ('hoop', 'tunnel')),
  is_away boolean not null default false,
  away_location text,
  sort int not null,
  unique (slot_id, event_type)
);

create table public.races (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.competition_events (id) on delete cascade,
  class text not null references public.stadium_classes (id),
  capacity int not null,
  status text not null default 'open' check (status in ('open', 'locked', 'running', 'finished', 'cancelled')),
  npc_lineup jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz
);

create index races_event_class_idx on public.races (event_id, class, created_at);
create index races_status_idx on public.races (status) where status in ('open', 'locked');

create table public.race_entries (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  lane int not null,
  status text not null default 'signed_up'
    check (status in ('signed_up', 'checked_in', 'withdrawn', 'no_show', 'finished')),
  pet_name text not null,
  pet_level int not null,
  species text not null check (species in ('dog', 'cat')),
  breed_id text not null,
  handle text,
  signed_up_at timestamptz not null default now(),
  checked_in_at timestamptz,
  last_seen_at timestamptz
);

create unique index race_entries_one_active_per_pet
  on public.race_entries (pet_id) where status in ('signed_up', 'checked_in');

create unique index race_entries_lane
  on public.race_entries (race_id, lane) where status in ('signed_up', 'checked_in', 'finished');

create index race_entries_race_idx on public.race_entries (race_id);

-- Kept apart from pets.doc, which only the client writes.
create table public.pet_race_state (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  cooldown_until timestamptz not null
);

alter table public.stadium_config enable row level security;
alter table public.stadium_classes enable row level security;
alter table public.competition_slots enable row level security;
alter table public.competition_events enable row level security;
alter table public.races enable row level security;
alter table public.race_entries enable row level security;
alter table public.pet_race_state enable row level security;

revoke all on public.stadium_config, public.stadium_classes, public.competition_slots, public.competition_events,
  public.races, public.race_entries, public.pet_race_state from anon, authenticated;
grant select on public.stadium_config, public.stadium_classes, public.competition_slots, public.competition_events,
  public.races to authenticated;

create policy stadium_config_read on public.stadium_config for select to authenticated using (true);
create policy stadium_classes_read on public.stadium_classes for select to authenticated using (true);
create policy competition_slots_read on public.competition_slots for select to authenticated using (true);
create policy competition_events_read on public.competition_events for select to authenticated using (true);
create policy races_read on public.races for select to authenticated using (true);
-- Entries carry player ids, so they are read only through the RPCs below.

create or replace function public.stadium_species(p_doc jsonb)
returns text
language sql
immutable
as $$
  select case
    when p_doc->>'breedId' in ('domesticShorthair', 'siamese', 'persian', 'maineCoon', 'scottishFold') then 'cat'
    else 'dog'
  end;
$$;

create or replace function public.stadium_class(p_level int)
returns text
language sql
stable
set search_path = public
as $$
  select id from public.stadium_classes
  where min_level <= greatest(1, coalesce(p_level, 1))
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
begin
  select * into cfg from public.stadium_config where id = 1;
  first_id := floor(extract(epoch from now()) / cfg.slot_seconds)::bigint + 1;
  for slot in first_id .. first_id + cfg.slots_shown loop
    insert into public.competition_slots (id, starts_at)
    values (slot, to_timestamp(slot * cfg.slot_seconds))
    on conflict (id) do nothing;
    if found then
      insert into public.competition_events (slot_id, event_type, species_allowed, required_obstacle, sort) values
        (slot, 'fetchSwat', 'both', null, 0),
        (slot, 'funRun', 'both', null, 1),
        (
          slot,
          case when slot % 2 = 0 then 'hoopHop' else 'tunnelRun' end,
          'both',
          case when slot % 2 = 0 then 'hoop' else 'tunnel' end,
          2
        )
      on conflict (slot_id, event_type) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.stadium_npcs(p_race_id uuid, p_count int, p_capacity int)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  names text[] := array['Pip', 'Nori', 'Biscuit', 'Miso', 'Pebble', 'Waffles', 'Mochi', 'Clover', 'Peanut', 'Tofu'];
  start int := abs(hashtext(p_race_id::text)) % array_length(names, 1);
  lineup jsonb := '[]'::jsonb;
  open_lane int;
  added int := 0;
begin
  for open_lane in 1 .. p_capacity loop
    exit when added >= p_count;
    if exists (
      select 1 from public.race_entries x
      where x.race_id = p_race_id and x.lane = open_lane and x.status in ('checked_in', 'finished')
    ) then
      continue;
    end if;
    lineup := lineup || jsonb_build_array(jsonb_build_object(
      'lane', open_lane,
      'name', names[1 + (start + added) % array_length(names, 1)],
      'species', case when (start + added) % 2 = 0 then 'dog' else 'cat' end
    ));
    added := added + 1;
  end loop;
  return lineup;
end;
$$;

-- Locks races at start minus lock_seconds and starts them at the start time.
-- There is no gameplay yet, so a started race finishes at once and the cooldown begins.
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

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'open'
      and s.starts_at - make_interval(secs => cfg.lock_seconds) <= now()
    for update of races skip locked
  loop
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
    select races.id, races.capacity
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'locked' and s.starts_at <= now()
    for update of races skip locked
  loop
    select count(*) into live from public.race_entries where race_id = r.id and status = 'checked_in';
    if live = 0 then
      update public.races set status = 'cancelled', started_at = now() where id = r.id;
      continue;
    end if;
    update public.race_entries set status = 'finished' where race_id = r.id and status = 'checked_in';
    update public.races
    set status = 'finished',
        started_at = now(),
        npc_lineup = case when live = 1 then public.stadium_npcs(r.id, cfg.npc_fill, r.capacity) else '[]'::jsonb end
    where id = r.id;
    insert into public.pet_race_state (pet_id, cooldown_until)
    select pet_id, now() + make_interval(secs => cfg.cooldown_seconds)
    from public.race_entries where race_id = r.id and status = 'finished'
    on conflict (pet_id) do update set cooldown_until = excluded.cooldown_until;
  end loop;
end;
$$;

create or replace function public.stadium_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_slots();
  perform public.advance_races();
end;
$$;

create or replace function public.stadium_owned_pet(p_pet_id uuid)
returns public.pets
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pet public.pets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into pet from public.pets
  where id = p_pet_id and owner_user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'pet not synced';
  end if;
  return pet;
end;
$$;

create or replace function public.stadium_entry_json(p_entry_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'entry_id', e.id,
    'race_id', e.race_id,
    'event_id', ev.id,
    'event_type', ev.event_type,
    'starts_at', s.starts_at,
    'class', r.class,
    'lane', e.lane,
    'status', e.status
  )
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.id = p_entry_id;
$$;

-- 'open', 'entered', 'busy', 'resting', 'missing_trick', 'wrong_species', or 'closed'.
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
  if ev.species_allowed <> 'both' and ev.species_allowed <> species then
    return 'wrong_species';
  end if;
  if ev.required_obstacle is not null
    and coalesce((p_pet.doc->'training'->(species || '_' || ev.required_obstacle)->>'mastered')::boolean, false) = false then
    return 'missing_trick';
  end if;
  if exists (select 1 from public.pet_race_state where pet_id = p_pet.id and cooldown_until > now()) then
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
          'required_trick', case when ev.required_obstacle is null then null else species || '_' || ev.required_obstacle end,
          'is_away', ev.is_away,
          'away_location', ev.away_location,
          'state', public.stadium_card_state(pet, ev.id),
          'signed_up', coalesce((
            select count(*) from public.race_entries e
            where e.race_id = coalesce(
              (select r.id from public.races r where r.id = my_race and r.event_id = ev.id),
              (
                select r.id from public.races r
                where r.event_id = ev.id and r.class = pet_class and r.status = 'open'
                  and (select count(*) from public.race_entries x
                       where x.race_id = r.id and x.status in ('signed_up', 'checked_in')) < r.capacity
                order by r.created_at
                limit 1
              )
            )
            and e.status in ('signed_up', 'checked_in')
          ), 0)
        ) order by ev.sort), '[]'::jsonb)
        from public.competition_events ev where ev.slot_id = s.id
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
      'cooldown_seconds', cfg.cooldown_seconds
    ),
    'class', pet_class,
    'species', species,
    'cooldown_until', (select cooldown_until from public.pet_race_state where pet_id = pet.id and cooldown_until > now()),
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

  if not exists (select 1 from public.competition_events where id = p_event_id) then
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

  pet_class := public.stadium_class((pet.doc->>'level')::int);
  perform pg_advisory_xact_lock(hashtext('stadium-race:' || p_event_id::text || ':' || pet_class));

  -- Friends go into the same race when there is room; otherwise races fill in sign-up order.
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
    insert into public.races (event_id, class, capacity)
    values (p_event_id, pet_class, cfg.capacity)
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

create or replace function public.withdraw(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  starts timestamptz;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into cfg from public.stadium_config where id = 1;
  select s.starts_at into starts
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.id = p_entry_id and e.player_id = auth.uid() and e.status in ('signed_up', 'checked_in') and r.status = 'open';
  if not found then
    return false;
  end if;
  if starts - make_interval(secs => cfg.lock_seconds) <= now() then
    raise exception 'locked';
  end if;
  update public.race_entries set status = 'withdrawn' where id = p_entry_id;
  return true;
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
  if not exists (select 1 from public.race_entries where race_id = p_race_id and player_id = auth.uid()) then
    raise exception 'not in race';
  end if;
  select jsonb_build_object(
    'server_now', now(),
    'race_id', r.id,
    'status', r.status,
    'class', r.class,
    'event_type', ev.event_type,
    'starts_at', s.starts_at,
    'npcs', r.npc_lineup,
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
        'mine', e.player_id = auth.uid()
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

-- Called every few seconds while the player is on the starting gate.
create or replace function public.gate_heartbeat(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  race uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into cfg from public.stadium_config where id = 1;
  update public.race_entries e
  set status = 'checked_in',
      checked_in_at = coalesce(e.checked_in_at, now()),
      last_seen_at = now()
  from public.races r, public.competition_events ev, public.competition_slots s
  where e.id = p_entry_id
    and e.player_id = auth.uid()
    and e.status in ('signed_up', 'checked_in')
    and r.id = e.race_id and r.status = 'open'
    and ev.id = r.event_id and s.id = ev.slot_id
    and s.starts_at - make_interval(secs => cfg.gate_open_seconds) <= now();
  select race_id into race from public.race_entries where id = p_entry_id and player_id = auth.uid();
  if race is null then
    raise exception 'not in race';
  end if;
  return public.race_state(race);
end;
$$;

revoke all on function public.stadium_species(jsonb) from public, anon;
revoke all on function public.stadium_class(int) from public, anon;
revoke all on function public.ensure_slots() from public, anon, authenticated;
revoke all on function public.stadium_npcs(uuid, int, int) from public, anon, authenticated;
revoke all on function public.advance_races() from public, anon, authenticated;
revoke all on function public.stadium_tick() from public, anon, authenticated;
revoke all on function public.stadium_owned_pet(uuid) from public, anon, authenticated;
revoke all on function public.stadium_entry_json(uuid) from public, anon, authenticated;
revoke all on function public.stadium_card_state(public.pets, uuid) from public, anon, authenticated;
revoke all on function public.get_upcoming_slots(uuid) from public, anon;
revoke all on function public.sign_up(uuid, uuid) from public, anon;
revoke all on function public.withdraw(uuid) from public, anon;
revoke all on function public.race_state(uuid) from public, anon;
revoke all on function public.gate_heartbeat(uuid) from public, anon;

grant execute on function public.stadium_tick() to service_role;
grant execute on function public.get_upcoming_slots(uuid) to authenticated;
grant execute on function public.sign_up(uuid, uuid) to authenticated;
grant execute on function public.withdraw(uuid) to authenticated;
grant execute on function public.race_state(uuid) to authenticated;
grant execute on function public.gate_heartbeat(uuid) to authenticated;
