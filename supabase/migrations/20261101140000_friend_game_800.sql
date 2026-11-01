-- 800 Meters can be a friend game, the same way Fun Run can. The owner applies this.
-- Do not run it against the hosted project from an agent.

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
  if p_event_type not in ('funRun', 'meters800', 'hurdles', 'obstacle') then
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
