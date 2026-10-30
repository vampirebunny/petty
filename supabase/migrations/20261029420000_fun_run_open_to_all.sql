-- Fun Run is open to all: every level races in one Open field. The Veteran cup keeps its own field,
-- and other events still race by level class. New Fun Run races use funrun-2 (Open NPCs for a mixed field).
-- Fun Run races already open in a level class run as they are.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.stadium_event_class(p_event_type text, p_cup text, p_level int)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_cup = 'veteran' then 'veteran'
    when p_event_type = 'funRun' then 'open'
    else public.stadium_class(p_level)
  end;
$$;

revoke all on function public.stadium_event_class(text, text, int) from public, anon;

create or replace function public.stadium_stamp_config_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kind text;
begin
  select event_type into kind from public.competition_events where id = new.event_id;
  if kind = 'dockDive' then
    new.config_version := 'dockdive-1';
  elsif kind = 'funRun' then
    new.config_version := 'funrun-2';
  end if;
  return new;
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

  pet_class := public.stadium_event_class(ev.event_type, ev.cup, (pet.doc->>'level')::int);
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
          'rest_until', (
            select prs.cooldown_until from public.pet_race_state prs
            where prs.pet_id = pet.id
              and prs.event_type = ev.event_type
              and prs.cooldown_until > now()
          ),
          'signed_up', coalesce((
            select count(*) from public.race_entries e
            where e.race_id = coalesce(
              (select r.id from public.races r where r.id = my_race and r.event_id = ev.id),
              (
                select r.id from public.races r
                where r.event_id = ev.id
                  and r.class = public.stadium_event_class(ev.event_type, ev.cup, (pet.doc->>'level')::int)
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
      'config_version', 'funrun-2'
    ),
    'class', pet_class,
    'species', species,
    'cooldown_until', null,
    'active_entry', case when entry_id is null then null else public.stadium_entry_json(entry_id) end,
    'slots', slots
  );
end;
$$;
