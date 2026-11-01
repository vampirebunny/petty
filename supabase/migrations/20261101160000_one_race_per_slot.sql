-- A pet may be signed up for several races at once, one per start time.
-- 11:45, 11:50, and 11:55 can all be entered together. A second event in the
-- same slot stays closed.
-- The owner applies this. Do not run it against the hosted project from an agent.

alter table public.race_entries add column if not exists slot_start timestamptz;

update public.race_entries e
set slot_start = s.starts_at
from public.races r
join public.competition_events ev on ev.id = r.event_id
join public.competition_slots s on s.id = ev.slot_id
where e.race_id = r.id
  and e.slot_start is distinct from s.starts_at;

create or replace function public.race_entries_stamp_slot_start()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select s.starts_at into new.slot_start
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = new.race_id;
  return new;
end;
$$;

drop trigger if exists race_entries_stamp_slot_start on public.race_entries;
create trigger race_entries_stamp_slot_start
  before insert or update of race_id on public.race_entries
  for each row execute function public.race_entries_stamp_slot_start();

drop index if exists public.race_entries_one_active_per_pet;

create unique index race_entries_one_active_per_slot
  on public.race_entries (pet_id, slot_start)
  where status in ('signed_up', 'checked_in') and pet_id is not null and slot_start is not null;

-- Another active entry at this exact start, or null.
create or replace function public.stadium_slot_conflict(p_pet_id uuid, p_starts_at timestamptz, p_skip_race uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'entry_id', e.id,
    'race_id', e.race_id,
    'event_type', ev.event_type,
    'cup', ev.cup,
    'starts_at', s.starts_at,
    'hosting', r.host_player_id is not null and r.host_player_id = e.player_id
  )
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.pet_id = p_pet_id
    and p_starts_at is not null
    and e.status in ('signed_up', 'checked_in')
    and s.starts_at = p_starts_at
    and (p_skip_race is null or e.race_id <> p_skip_race)
  limit 1;
$$;

revoke all on function public.stadium_slot_conflict(uuid, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.friend_game_conflict(p_pet_id uuid, p_skip_race uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.stadium_slot_conflict(
    p_pet_id,
    (
      select s.starts_at
      from public.races r
      join public.competition_events ev on ev.id = r.event_id
      join public.competition_slots s on s.id = ev.slot_id
      where r.id = p_skip_race
    ),
    p_skip_race
  );
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

  -- Busy only when this same start already has a different event. Other slots stay open.
  select r.event_id into active_event
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events active_ev on active_ev.id = r.event_id
  join public.competition_slots active_slot on active_slot.id = active_ev.slot_id
  where e.pet_id = p_pet.id
    and e.status in ('signed_up', 'checked_in')
    and active_slot.id = ev.slot_id
    and r.status in ('open', 'locked', 'countdown', 'running')
    and active_slot.starts_at + public.stadium_dnf_after(active_ev.event_type) > now();
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
    select 1 from public.pet_race_state prs
    where prs.pet_id = p_pet.id and prs.event_type = ev.event_type and prs.cooldown_until > starts
  ) then
    return 'resting';
  end if;
  if active_event is not null then
    return 'busy';
  end if;
  return 'open';
end;
$$;

revoke all on function public.stadium_card_state(public.pets, uuid) from public, anon, authenticated;

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
    return public.stadium_entry_json((
      select e.id
      from public.race_entries e
      join public.races r on r.id = e.race_id
      where e.pet_id = pet.id
        and r.event_id = p_event_id
        and e.status in ('signed_up', 'checked_in')
      limit 1
    ));
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
  entries jsonb;
  friend_race uuid;
  slots jsonb;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  select * into cfg from public.stadium_config where id = 1;
  species := public.stadium_species(pet.doc);
  pet_class := public.stadium_class((pet.doc->>'level')::int);

  select coalesce(jsonb_agg(public.stadium_entry_json(e.id) order by s.starts_at), '[]'::jsonb)
  into entries
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in') and ev.cup <> 'friends';

  select e.race_id into friend_race
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in') and ev.cup = 'friends'
  order by s.starts_at
  limit 1;

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
              (
                select r.id from public.races r
                join public.race_entries mine on mine.race_id = r.id
                where mine.pet_id = pet.id
                  and mine.status in ('signed_up', 'checked_in')
                  and r.event_id = ev.id
                limit 1
              ),
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
          and (ev.cup = 'open' or (ev.cup = 'veteran' and public.stadium_is_senior(pet.doc)))
      )
    ) as slot_row
    from public.competition_slots s
    where s.starts_at > now() and not s.private
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
    'active_entry', entries->0,
    'active_entries', entries,
    'friend_game_race_id', friend_race,
    'slots', slots
  );
end;
$$;

create or replace function public.create_friend_game(
  p_pet_id uuid,
  p_event_type text,
  p_delay_minutes int,
  p_invitees uuid[],
  p_replace boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cfg public.stadium_config%rowtype;
  pet public.pets%rowtype;
  invitees uuid[];
  conflict jsonb;
  race_status text;
  slot_starts timestamptz;
  slot_id bigint;
  event_id uuid;
  new_race uuid;
  starts timestamptz;
  friend uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select * into cfg from public.stadium_config where id = 1;
  if p_event_type not in ('funRun', 'meters800', 'hurdles', 'obstacle') then
    return jsonb_build_object('ok', false, 'error', 'bad_event');
  end if;
  if p_delay_minutes is null or not (p_delay_minutes = any(cfg.friend_game_delays)) then
    return jsonb_build_object('ok', false, 'error', 'bad_delay');
  end if;
  select coalesce(array_agg(distinct x), '{}') into invitees
  from unnest(coalesce(p_invitees, '{}')) as x
  where x is not null and x <> uid;
  if cardinality(invitees) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_friends');
  end if;
  if cardinality(invitees) > cfg.friend_game_max_invites then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  foreach friend in array invitees loop
    if not public.friend_game_are_friends(uid, friend) then
      return jsonb_build_object('ok', false, 'error', 'not_friends');
    end if;
  end loop;

  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  perform pg_advisory_xact_lock(hashtext('stadium-pet:' || pet.id::text));

  starts := date_trunc('second', now()) + make_interval(mins => p_delay_minutes);
  conflict := public.stadium_slot_conflict(pet.id, starts, null);
  if conflict is not null then
    if not coalesce(p_replace, false) then
      return jsonb_build_object('ok', false, 'error', 'conflict', 'conflict', conflict);
    end if;
    select r.status, s.starts_at into race_status, slot_starts
    from public.races r
    join public.competition_events ev on ev.id = r.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where r.id = (conflict->>'race_id')::uuid;
    if race_status <> 'open' or slot_starts - make_interval(secs => cfg.lock_seconds) <= now() then
      return jsonb_build_object('ok', false, 'error', 'race_starting');
    end if;
    if (conflict->>'hosting')::boolean then
      update public.race_entries set status = 'withdrawn'
      where id = (conflict->>'entry_id')::uuid and player_id = uid;
      perform public.friend_game_cancel((conflict->>'race_id')::uuid);
    else
      update public.race_entries set status = 'withdrawn'
      where id = (conflict->>'entry_id')::uuid and player_id = uid;
      update public.friend_game_invites set status = 'declined', responded_at = now()
      where race_id = (conflict->>'race_id')::uuid and invitee_id = uid and status = 'accepted';
    end if;
  end if;

  slot_id := -nextval('public.friend_game_slot_seq');
  insert into public.competition_slots (id, starts_at, private) values (slot_id, starts, true);
  insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
  values (slot_id, p_event_type, 'both', '{}'::text[], 'friends', 0)
  returning id into event_id;
  insert into public.races (event_id, class, capacity, seed, config_version, host_player_id)
  values (
    event_id,
    'open',
    cardinality(invitees) + 1,
    substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16),
    'funrun-1',
    uid
  )
  returning id into new_race;
  perform public.friend_game_insert_entry(new_race, pet, uid);
  insert into public.friend_game_invites (race_id, inviter_id, invitee_id)
  select new_race, uid, x from unnest(invitees) as x;

  return jsonb_build_object('ok', true, 'race_id', new_race, 'starts_at', starts);
end;
$$;
