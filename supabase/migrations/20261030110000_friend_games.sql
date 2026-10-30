-- Friend games: a private race for a host and up to 5 mutual friends, starting 2, 5, or 15
-- minutes after the invites go out. Each game is its own private slot, event (cup 'friends'),
-- and race in class 'open', so lock, presence, start, live sync, race_report, and ranking are
-- the open-race code. Friends races never get NPCs, never start the rest, and cancel unless
-- the host and at least one friend are checked in.

alter table public.competition_slots add column if not exists private boolean not null default false;
alter table public.competition_slots drop constraint if exists competition_slots_starts_at_key;
create unique index if not exists competition_slots_scheduled_starts_at
  on public.competition_slots (starts_at) where not private;

create sequence if not exists public.friend_game_slot_seq;
revoke all on sequence public.friend_game_slot_seq from public, anon, authenticated;

alter table public.competition_events drop constraint if exists competition_events_cup_check;
alter table public.competition_events
  add constraint competition_events_cup_check check (cup in ('open', 'veteran', 'friends'));

alter table public.races add column if not exists host_player_id uuid references auth.users (id) on delete set null;

alter table public.stadium_config
  add column if not exists friend_game_delays int[] not null default '{2,5,15}',
  add column if not exists friend_game_max_invites int not null default 5;

create table if not exists public.friend_game_invites (
  race_id uuid not null references public.races (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  notified_at timestamptz,
  primary key (race_id, invitee_id)
);

create index if not exists friend_game_invites_invitee_pending
  on public.friend_game_invites (invitee_id) where status = 'pending';
create index if not exists friend_game_invites_inviter_created
  on public.friend_game_invites (inviter_id, created_at desc);

alter table public.friend_game_invites enable row level security;
revoke all on table public.friend_game_invites from public, anon, authenticated;
grant all on table public.friend_game_invites to service_role;

-- The first required trick this pet has not mastered, or null.
create or replace function public.friend_game_missing_trick(p_doc jsonb, p_event_type text)
returns text
language sql
stable
set search_path = public
as $$
  select public.stadium_trick_id(public.stadium_species(p_doc), trick)
  from unnest(public.stadium_required_tricks(p_event_type)) as trick
  where coalesce((p_doc->'training'->public.stadium_trick_id(public.stadium_species(p_doc), trick)->>'mastered')::boolean, false) = false
  limit 1;
$$;

revoke all on function public.friend_game_missing_trick(jsonb, text) from public, anon, authenticated;

create or replace function public.friend_game_are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_a_id = least(p_a, p_b) and f.user_b_id = greatest(p_a, p_b)
  ) and not public.users_blocked(p_a, p_b);
$$;

revoke all on function public.friend_game_are_friends(uuid, uuid) from public, anon, authenticated;

-- Cancels a friend game: the race, every active entry, and every pending invite.
create or replace function public.friend_game_cancel(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.races set status = 'cancelled'
  where id = p_race_id and status in ('open', 'locked', 'countdown');
  update public.friend_game_invites set status = 'withdrawn', responded_at = coalesce(responded_at, now())
  where race_id = p_race_id and status = 'pending';
  update public.race_entries set status = 'no_show'
  where race_id = p_race_id and status in ('signed_up', 'checked_in');
end;
$$;

revoke all on function public.friend_game_cancel(uuid) from public, anon, authenticated;

-- The pet's other active race, as conflict JSON for the warning, or null.
create or replace function public.friend_game_conflict(p_pet_id uuid, p_skip_race uuid)
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
    and e.status in ('signed_up', 'checked_in')
    and (p_skip_race is null or e.race_id <> p_skip_race)
  limit 1;
$$;

revoke all on function public.friend_game_conflict(uuid, uuid) from public, anon, authenticated;

-- Frees the pet from its other active race so it can join a friend game.
-- Hosting a friend game cancels it. Anything else is withdrawn, which needs the race still open.
create or replace function public.friend_game_release(p_pet_id uuid, p_skip_race uuid, p_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  conflict jsonb;
  race_status text;
  starts timestamptz;
begin
  select * into cfg from public.stadium_config where id = 1;
  conflict := public.friend_game_conflict(p_pet_id, p_skip_race);
  if conflict is null then
    return null;
  end if;
  select r.status, s.starts_at into race_status, starts
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = (conflict->>'race_id')::uuid;
  if race_status <> 'open' or starts - make_interval(secs => cfg.lock_seconds) <= now() then
    return 'race_starting';
  end if;
  if (conflict->>'hosting')::boolean then
    update public.race_entries set status = 'withdrawn'
    where id = (conflict->>'entry_id')::uuid and player_id = p_uid;
    perform public.friend_game_cancel((conflict->>'race_id')::uuid);
    return null;
  end if;
  update public.race_entries set status = 'withdrawn'
  where id = (conflict->>'entry_id')::uuid and player_id = p_uid;
  update public.friend_game_invites set status = 'declined', responded_at = now()
  where race_id = (conflict->>'race_id')::uuid and invitee_id = p_uid and status = 'accepted';
  return null;
end;
$$;

revoke all on function public.friend_game_release(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.friend_game_insert_entry(p_race_id uuid, p_pet public.pets, p_uid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
  free_lane int;
  new_entry uuid;
begin
  select capacity into cap from public.races where id = p_race_id;
  select min(g.n) into free_lane
  from generate_series(1, cap) as g(n)
  where not exists (
    select 1 from public.race_entries x
    where x.race_id = p_race_id and x.lane = g.n and x.status in ('signed_up', 'checked_in', 'finished')
  );
  if free_lane is null then
    raise exception 'full';
  end if;
  insert into public.race_entries (race_id, pet_id, player_id, lane, pet_name, pet_level, species, breed_id, handle, last_seen_at)
  values (
    p_race_id,
    p_pet.id,
    p_uid,
    free_lane,
    coalesce(p_pet.doc->>'name', 'Pet'),
    greatest(1, coalesce((p_pet.doc->>'level')::int, 1)),
    public.stadium_species(p_pet.doc),
    coalesce(p_pet.doc->>'breedId', ''),
    (select handle from public.profiles where user_id = p_uid),
    now()
  )
  returning id into new_entry;
  return new_entry;
end;
$$;

revoke all on function public.friend_game_insert_entry(uuid, public.pets, uuid) from public, anon, authenticated;

-- Friends this player can invite to the event, with the most recently invited first.
create or replace function public.friend_game_candidates(p_event_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_event_type not in ('funRun', 'hurdles', 'obstacle') then
    return jsonb_build_object('ok', false, 'error', 'bad_event');
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', friend.other_id,
        'handle', profile.handle,
        'pet', public.friend_pet_card(friend.other_id),
        'hasPet', pet.id is not null,
        'missingTrick', case when pet.id is null then null else public.friend_game_missing_trick(pet.doc, p_event_type) end,
        'lastInvitedAt', (
          select max(i.created_at) from public.friend_game_invites i
          where i.inviter_id = uid and i.invitee_id = friend.other_id
        )
      ) order by profile.handle)
      from (
        select case when f.user_a_id = uid then f.user_b_id else f.user_a_id end as other_id
        from public.friendships f
        where f.user_a_id = uid or f.user_b_id = uid
      ) friend
      join public.profiles profile on profile.user_id = friend.other_id
      left join lateral (
        select p.id, p.doc from public.pets p
        where p.owner_user_id = friend.other_id and p.status = 'active'
        order by p.updated_at desc
        limit 1
      ) pet on true
      where not public.users_blocked(uid, friend.other_id)
    ), '[]'::jsonb)
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
  missing text;
  conflict jsonb;
  released text;
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
  if p_event_type not in ('funRun', 'hurdles', 'obstacle') then
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
  missing := public.friend_game_missing_trick(pet.doc, p_event_type);
  if missing is not null then
    return jsonb_build_object('ok', false, 'error', 'missing_trick', 'trick', missing);
  end if;

  conflict := public.friend_game_conflict(pet.id, null);
  if conflict is not null then
    if not coalesce(p_replace, false) then
      return jsonb_build_object('ok', false, 'error', 'conflict', 'conflict', conflict);
    end if;
    released := public.friend_game_release(pet.id, null, uid);
    if released is not null then
      return jsonb_build_object('ok', false, 'error', released);
    end if;
  end if;

  starts := date_trunc('second', now()) + make_interval(mins => p_delay_minutes);
  slot_id := -nextval('public.friend_game_slot_seq');
  insert into public.competition_slots (id, starts_at, private) values (slot_id, starts, true);
  insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
  values (slot_id, p_event_type, 'both', public.stadium_required_tricks(p_event_type), 'friends', 0)
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

create or replace function public.list_friend_game_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cfg public.stadium_config%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  perform public.advance_races();
  select * into cfg from public.stadium_config where id = 1;
  return jsonb_build_object(
    'ok', true,
    'server_now', now(),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'raceId', i.race_id,
        'hostId', i.inviter_id,
        'hostHandle', profile.handle,
        'hostPetName', host_entry.pet_name,
        'eventType', ev.event_type,
        'startsAt', s.starts_at,
        'createdAt', i.created_at
      ) order by i.created_at desc)
      from public.friend_game_invites i
      join public.races r on r.id = i.race_id
      join public.competition_events ev on ev.id = r.event_id
      join public.competition_slots s on s.id = ev.slot_id
      left join public.profiles profile on profile.user_id = i.inviter_id
      left join lateral (
        select e.pet_name from public.race_entries e
        where e.race_id = r.id and e.player_id = i.inviter_id
        order by e.signed_up_at limit 1
      ) host_entry on true
      where i.invitee_id = uid
        and i.status = 'pending'
        and r.status = 'open'
        and s.starts_at - make_interval(secs => cfg.lock_seconds) > now()
        and not public.users_blocked(uid, i.inviter_id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.respond_friend_game_invite(
  p_race_id uuid,
  p_action text,
  p_pet_id uuid default null,
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
  invite public.friend_game_invites%rowtype;
  race_status text;
  starts timestamptz;
  kind text;
  pet public.pets%rowtype;
  missing text;
  conflict jsonb;
  released text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_action not in ('accept', 'decline') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  perform public.advance_races();
  select * into cfg from public.stadium_config where id = 1;
  select * into invite from public.friend_game_invites where race_id = p_race_id and invitee_id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select r.status, s.starts_at, ev.event_type into race_status, starts, kind
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  if race_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;
  if race_status <> 'open' or starts - make_interval(secs => cfg.lock_seconds) <= now() then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;

  if p_action = 'decline' then
    update public.friend_game_invites set status = 'declined', responded_at = now()
    where race_id = p_race_id and invitee_id = uid and status in ('pending', 'accepted');
    update public.race_entries set status = 'withdrawn'
    where race_id = p_race_id and player_id = uid and status in ('signed_up', 'checked_in');
    return jsonb_build_object('ok', true);
  end if;

  if invite.status = 'accepted' and exists (
    select 1 from public.race_entries
    where race_id = p_race_id and player_id = uid and status in ('signed_up', 'checked_in')
  ) then
    return jsonb_build_object('ok', true, 'race_id', p_race_id, 'starts_at', starts);
  end if;
  if invite.status not in ('pending', 'accepted') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if public.users_blocked(uid, invite.inviter_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  pet := public.stadium_owned_pet(p_pet_id);
  perform pg_advisory_xact_lock(hashtext('stadium-pet:' || pet.id::text));
  missing := public.friend_game_missing_trick(pet.doc, kind);
  if missing is not null then
    return jsonb_build_object('ok', false, 'error', 'missing_trick', 'trick', missing);
  end if;
  conflict := public.friend_game_conflict(pet.id, p_race_id);
  if conflict is not null then
    if not coalesce(p_replace, false) then
      return jsonb_build_object('ok', false, 'error', 'conflict', 'conflict', conflict);
    end if;
    released := public.friend_game_release(pet.id, p_race_id, uid);
    if released is not null then
      return jsonb_build_object('ok', false, 'error', released);
    end if;
  end if;

  perform public.friend_game_insert_entry(p_race_id, pet, uid);
  update public.friend_game_invites set status = 'accepted', responded_at = now()
  where race_id = p_race_id and invitee_id = uid;
  update public.friend_game_invites set status = 'declined', responded_at = now()
  where invitee_id = uid and race_id <> p_race_id and status = 'pending';
  return jsonb_build_object('ok', true, 'race_id', p_race_id, 'starts_at', starts);
end;
$$;

create or replace function public.friend_game_state(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cfg public.stadium_config%rowtype;
  host uuid;
  race_status text;
  starts timestamptz;
  kind text;
  in_race boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  perform public.advance_races();
  select * into cfg from public.stadium_config where id = 1;
  select r.host_player_id, r.status, s.starts_at, ev.event_type into host, race_status, starts, kind
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id and ev.cup = 'friends';
  if host is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if uid <> host and not exists (
    select 1 from public.friend_game_invites where race_id = p_race_id and invitee_id = uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  in_race := exists (select 1 from public.race_entries where race_id = p_race_id and player_id = uid);
  return jsonb_build_object(
    'ok', true,
    'server_now', now(),
    'race_id', p_race_id,
    'status', race_status,
    'event_type', kind,
    'starts_at', starts,
    'host_id', host,
    'mine_host', uid = host,
    'host_handle', (select handle from public.profiles where user_id = host),
    'cancel_reason', case
      when race_status <> 'cancelled' then null
      when exists (
        select 1 from public.race_entries
        where race_id = p_race_id and player_id = host and status = 'withdrawn'
      ) then 'host_left'
      else 'not_enough'
    end,
    'race', case when in_race then public.race_state_for(p_race_id, uid) else null end,
    'members', coalesce((
      select jsonb_agg(member order by (member->>'host')::boolean desc, member->>'handle')
      from (
        select jsonb_build_object(
          'userId', u.user_id,
          'handle', profile.handle,
          'host', u.user_id = host,
          'petName', coalesce(entry.pet_name, public.friend_pet_card(u.user_id)->>'name'),
          'status', u.status,
          'mine', u.user_id = uid,
          'joined', entry.id is not null
            and entry.status in ('signed_up', 'checked_in')
            and (entry.status = 'checked_in' and race_status <> 'open'
              or entry.last_seen_at >= now() - make_interval(secs => cfg.presence_grace_seconds))
        ) as member
        from (
          select host as user_id, 'host'::text as status
          union all
          select i.invitee_id, i.status from public.friend_game_invites i where i.race_id = p_race_id
        ) u
        left join public.profiles profile on profile.user_id = u.user_id
        left join lateral (
          select e.id, e.pet_name, e.status, e.last_seen_at from public.race_entries e
          where e.race_id = p_race_id and e.player_id = u.user_id
          order by e.signed_up_at desc limit 1
        ) entry on true
      ) members
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.friend_game_heartbeat(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  update public.race_entries e
  set last_seen_at = now()
  from public.races r
  where e.race_id = p_race_id
    and r.id = e.race_id
    and r.status = 'open'
    and e.player_id = uid
    and e.status in ('signed_up', 'checked_in');
  return public.friend_game_state(p_race_id);
end;
$$;

create or replace function public.leave_friend_game(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cfg public.stadium_config%rowtype;
  host uuid;
  race_status text;
  starts timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  perform public.advance_races();
  select * into cfg from public.stadium_config where id = 1;
  select r.host_player_id, r.status, s.starts_at into host, race_status, starts
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id and ev.cup = 'friends';
  if host is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if uid = host then
    if race_status in ('open', 'locked', 'countdown') then
      update public.race_entries set status = 'withdrawn'
      where race_id = p_race_id and player_id = uid and status in ('signed_up', 'checked_in');
      perform public.friend_game_cancel(p_race_id);
    end if;
    return jsonb_build_object('ok', true, 'cancelled', true);
  end if;
  if race_status <> 'open' or starts - make_interval(secs => cfg.lock_seconds) <= now() then
    return jsonb_build_object('ok', false, 'error', 'started');
  end if;
  update public.race_entries set status = 'withdrawn'
  where race_id = p_race_id and player_id = uid and status in ('signed_up', 'checked_in');
  update public.friend_game_invites set status = 'declined', responded_at = now()
  where race_id = p_race_id and invitee_id = uid;
  return jsonb_build_object('ok', true, 'cancelled', false);
end;
$$;

-- Friends races do not start the rest.
create or replace function public.stadium_finish_cooldown(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  race_event text;
  race_cup text;
  started timestamptz;
  until timestamptz;
begin
  select * into cfg from public.stadium_config where id = 1;
  select ev.event_type, ev.cup, coalesce(r.started_at, s.starts_at)
  into race_event, race_cup, started
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  if race_event is null or started is null or race_cup = 'friends' then
    return;
  end if;
  -- Rest ends at the race start plus the configured rest. A result that arrives
  -- late must not start that rest over from the moment it is written.
  until := started + make_interval(secs => cfg.cooldown_seconds);
  insert into public.pet_race_state (pet_id, event_type, cooldown_until)
  select e.pet_id, race_event, until
  from public.race_entries e
  where e.race_id = p_race_id and not e.is_npc and e.status = 'finished' and e.pet_id is not null
  on conflict (pet_id, event_type) do update
  set cooldown_until = greatest(public.pet_race_state.cooldown_until, excluded.cooldown_until);
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
  host_in boolean;
begin
  select * into cfg from public.stadium_config where id = 1;
  perform public.stadium_merge_classes();

  for r in
    select races.id, ev.event_type, ev.cup, races.host_player_id
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
    if r.cup = 'friends' then
      update public.friend_game_invites set status = 'withdrawn', responded_at = now()
      where race_id = r.id and status = 'pending';
      select count(*) into live
      from public.race_entries
      where race_id = r.id and status = 'checked_in' and not is_npc;
      host_in := exists (
        select 1 from public.race_entries
        where race_id = r.id and status = 'checked_in' and player_id = r.host_player_id
      );
      if not host_in or live < 2 then
        perform public.friend_game_cancel(r.id);
      end if;
      continue;
    end if;
    if r.event_type in ('funRun', 'hurdles', 'dockDive', 'obstacle') then
      select count(*) into live
      from public.race_entries
      where race_id = r.id and status = 'checked_in' and not is_npc;
      if live = 1 then
        perform public.stadium_fill_npcs(r.id);
      end if;
    end if;
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
    select races.id, ev.event_type, ev.cup, races.host_player_id, s.starts_at
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status in ('locked', 'countdown') and s.starts_at <= now()
    for update of races skip locked
  loop
    select count(*) into live
    from public.race_entries
    where race_id = r.id and status = 'checked_in' and not is_npc;
    if r.cup = 'friends' then
      host_in := exists (
        select 1 from public.race_entries
        where race_id = r.id and status = 'checked_in' and player_id = r.host_player_id
      );
      if not host_in or live < 2 then
        perform public.friend_game_cancel(r.id);
        update public.races set started_at = r.starts_at where id = r.id;
        continue;
      end if;
      update public.races set status = 'running', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if live = 0 then
      update public.races set status = 'cancelled', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if r.event_type not in ('funRun', 'hurdles', 'dockDive', 'obstacle') then
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

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'running'
      and s.starts_at + public.stadium_dnf_after(ev.event_type) <= now()
    for update of races skip locked
  loop
    perform public.stadium_maybe_finalize(r.id);
  end loop;

  perform public.stadium_release_closed_entries();
end;
$$;

grant execute on function public.advance_races() to service_role;

-- The open board hides private friend-game slots. active_entry is open races only;
-- friend_game_race_id points at the pet's active friend game.
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
  friend_race uuid;
  slots jsonb;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  select * into cfg from public.stadium_config where id = 1;
  species := public.stadium_species(pet.doc);
  pet_class := public.stadium_class((pet.doc->>'level')::int);

  select e.id, e.race_id into entry_id, my_race
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in') and ev.cup <> 'friends';

  select e.race_id into friend_race
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events ev on ev.id = r.event_id
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in') and ev.cup = 'friends';

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
    'active_entry', case when entry_id is null then null else public.stadium_entry_json(entry_id) end,
    'friend_game_race_id', friend_race,
    'slots', slots
  );
end;
$$;

revoke all on function public.friend_game_candidates(text) from public, anon;
revoke all on function public.create_friend_game(uuid, text, int, uuid[], boolean) from public, anon;
revoke all on function public.list_friend_game_invites() from public, anon;
revoke all on function public.respond_friend_game_invite(uuid, text, uuid, boolean) from public, anon;
revoke all on function public.friend_game_state(uuid) from public, anon;
revoke all on function public.friend_game_heartbeat(uuid) from public, anon;
revoke all on function public.leave_friend_game(uuid) from public, anon;

grant execute on function public.friend_game_candidates(text) to authenticated;
grant execute on function public.create_friend_game(uuid, text, int, uuid[], boolean) to authenticated;
grant execute on function public.list_friend_game_invites() to authenticated;
grant execute on function public.respond_friend_game_invite(uuid, text, uuid, boolean) to authenticated;
grant execute on function public.friend_game_state(uuid) to authenticated;
grant execute on function public.friend_game_heartbeat(uuid) to authenticated;
grant execute on function public.leave_friend_game(uuid) to authenticated;
