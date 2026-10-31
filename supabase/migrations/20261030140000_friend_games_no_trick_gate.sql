-- Friend games do not require tricks. Open and veteran cups still do, through
-- stadium_required_tricks and stadium_card_state. The owner applies this.
-- Do not run it against the hosted project from an agent.

-- Kept so friend_game_candidates can keep calling it. Always null: a friend game
-- never blocks on a missing trick.
create or replace function public.friend_game_missing_trick(p_doc jsonb, p_event_type text)
returns text
language sql
stable
set search_path = public
as $$
  select null::text where p_doc is not null or p_event_type is not null or true;
$$;

revoke all on function public.friend_game_missing_trick(jsonb, text) from public, anon, authenticated;

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
  pet public.pets%rowtype;
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
  select r.status, s.starts_at into race_status, starts
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

-- Games already created still listed the competitive tricks. Clear them so a
-- friends cup never reads as missing a skill.
update public.competition_events
set required_tricks = '{}'::text[]
where cup = 'friends' and cardinality(required_tricks) > 0;
