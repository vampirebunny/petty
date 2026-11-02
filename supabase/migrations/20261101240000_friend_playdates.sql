-- Shared friend playdates. The initiator uploads the finished record. Guests can read and replay it.
-- Bond stays on the initiator's phone. A guest row does not change the friend's bond or cooldown.

create table public.playdates (
  id uuid primary key,
  initiator_id uuid references auth.users (id) on delete set null,
  record jsonb not null,
  record_version int not null,
  played_at timestamptz not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.playdate_participants (
  playdate_id uuid not null references public.playdates (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('initiator', 'guest')),
  seen_at timestamptz,
  primary key (playdate_id, player_id)
);

create index playdate_participants_player
  on public.playdate_participants (player_id, playdate_id);

alter table public.playdates enable row level security;
alter table public.playdate_participants enable row level security;

revoke all on public.playdates, public.playdate_participants from public, anon, authenticated;

grant select on public.playdates, public.playdate_participants to authenticated;
grant update (seen_at) on public.playdate_participants to authenticated;

create policy playdates_select_participant on public.playdates
  for select to authenticated
  using (
    exists (
      select 1 from public.playdate_participants mine
      where mine.playdate_id = playdates.id and mine.player_id = auth.uid()
    )
  );

create policy playdate_participants_select_self on public.playdate_participants
  for select to authenticated
  using (player_id = auth.uid());

create policy playdate_participants_update_seen on public.playdate_participants
  for update to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

create or replace function public.playdate_rename_pet(snapshot jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when snapshot is null then null
    else jsonb_set(
      snapshot,
      '{name}',
      to_jsonb(case when coalesce(snapshot->>'species', 'dog') = 'cat' then 'Kitty' else 'Pup' end),
      true
    ) || jsonb_build_object('anonymized', true)
  end;
$$;

revoke all on function public.playdate_rename_pet(jsonb) from public, anon, authenticated;

create or replace function public.playdate_scrub_user(p_record jsonb, p_user_id uuid, p_initiator boolean)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := p_record;
  party jsonb := '[]'::jsonb;
  item jsonb;
  friend_key text := 'friend:' || p_user_id::text;
begin
  if result is null then
    return result;
  end if;
  if p_initiator and result ? 'petA' then
    result := jsonb_set(result, '{petA}', public.playdate_rename_pet(result->'petA'), true);
    result := result || jsonb_build_object('initiatorFormer', true);
  end if;
  if coalesce(result->'petB'->>'snapshotId', '') = friend_key then
    result := jsonb_set(result, '{petB}', public.playdate_rename_pet(result->'petB'), true);
  end if;
  if jsonb_typeof(result->'party') = 'array' then
    for item in select value from jsonb_array_elements(result->'party')
    loop
      if coalesce(item->>'snapshotId', '') = friend_key then
        item := public.playdate_rename_pet(item);
      end if;
      party := party || jsonb_build_array(item);
    end loop;
    result := jsonb_set(result, '{party}', party, true);
  end if;
  return result;
end;
$$;

revoke all on function public.playdate_scrub_user(jsonb, uuid, boolean) from public, anon, authenticated;

create or replace function public.submit_friend_playdate(p_record jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  playdate_id uuid;
  guest_ids uuid[] := '{}';
  kept uuid[] := '{}';
  guest uuid;
  raw text;
  item jsonb;
  played_at timestamptz;
  version int;
begin
  if uid is null then
    return jsonb_build_object('error', 'account required');
  end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    return jsonb_build_object('error', 'not found');
  end if;
  begin
    playdate_id := (p_record->>'playdateId')::uuid;
  exception when others then
    return jsonb_build_object('error', 'not found');
  end;

  if exists (select 1 from public.playdates where id = playdate_id) then
    if not exists (
      select 1 from public.playdates where id = playdate_id and initiator_id = uid
    ) then
      return jsonb_build_object('error', 'not found');
    end if;
    return jsonb_build_object('status', 'exists', 'id', playdate_id);
  end if;

  if coalesce(p_record->'petB'->>'source', '') = 'friend' then
    raw := coalesce(p_record->'petB'->>'snapshotId', '');
    if split_part(raw, ':', 1) = 'friend' then
      begin
        guest := split_part(raw, ':', 2)::uuid;
        if guest <> uid then
          guest_ids := array_append(guest_ids, guest);
        end if;
      exception when others then
        null;
      end;
    end if;
  end if;

  if jsonb_typeof(p_record->'party') = 'array' then
    for item in select value from jsonb_array_elements(p_record->'party')
    loop
      raw := coalesce(item->>'snapshotId', '');
      if coalesce(item->>'source', '') = 'friend' and split_part(raw, ':', 1) = 'friend' then
        begin
          guest := split_part(raw, ':', 2)::uuid;
          if guest <> uid and not guest = any (guest_ids) then
            guest_ids := array_append(guest_ids, guest);
          end if;
        exception when others then
          null;
        end;
      end if;
    end loop;
  end if;

  foreach guest in array guest_ids loop
    if public.friend_game_are_friends(uid, guest) then
      kept := array_append(kept, guest);
    end if;
  end loop;

  if cardinality(kept) = 0 then
    return jsonb_build_object('status', 'skipped');
  end if;

  version := coalesce((p_record->>'version')::int, 0);
  begin
    played_at := nullif(p_record->>'createdAt', '')::timestamptz;
  exception when others then
    played_at := null;
  end;

  insert into public.playdates (id, initiator_id, record, record_version, played_at)
  values (playdate_id, uid, p_record, version, coalesce(played_at, now()));

  insert into public.playdate_participants (playdate_id, player_id, role)
  values (playdate_id, uid, 'initiator');

  insert into public.playdate_participants (playdate_id, player_id, role)
  select playdate_id, g, 'guest'
  from unnest(kept) as g;

  return jsonb_build_object('status', 'inserted', 'id', playdate_id);
end;
$$;

revoke all on function public.submit_friend_playdate(jsonb) from public, anon, authenticated;
grant execute on function public.submit_friend_playdate(jsonb) to authenticated;

create or replace function public.list_friend_playdates()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'seenAt', pp.seen_at,
      'record', p.record,
      'recordVersion', p.record_version
    ) order by p.played_at desc)
    from public.playdate_participants pp
    join public.playdates p on p.id = pp.playdate_id
    where pp.player_id = uid and pp.role = 'guest'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_friend_playdates() from public, anon, authenticated;
grant execute on function public.list_friend_playdates() to authenticated;

create or replace function public.mark_playdate_seen(p_playdate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null or p_playdate_id is null then
    return;
  end if;
  update public.playdate_participants
  set seen_at = coalesce(seen_at, now())
  where playdate_id = p_playdate_id and player_id = uid;
end;
$$;

revoke all on function public.mark_playdate_seen(uuid) from public, anon, authenticated;
grant execute on function public.mark_playdate_seen(uuid) to authenticated;

create or replace function public.delete_friend_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  held text;
begin
  select handle_lower into held from public.profiles where user_id = p_user_id;
  if held is not null then
    insert into public.handle_holds (handle_lower, released_at)
    values (held, now() + interval '15 days')
    on conflict (handle_lower) do update
      set released_at = greatest(public.handle_holds.released_at, excluded.released_at);
  end if;
  delete from public.friend_requests
    where requester_id = p_user_id or addressee_id = p_user_id;
  delete from public.friendships
    where user_a_id = p_user_id or user_b_id = p_user_id;
  delete from public.blocks
    where blocker_id = p_user_id or blocked_id = p_user_id;
  delete from public.park_presence where user_id = p_user_id;
  delete from public.push_tokens where player_id = p_user_id;
  delete from public.notification_settings where user_id = p_user_id;
  delete from public.reports where reporter_id = p_user_id;
  update public.reports
    set reported_id = null, reported_deleted = true
    where reported_id = p_user_id;

  update public.runway_shows
    set host_handle = 'Former player',
        host_anonymized = true,
        host_player_id = null
    where host_player_id = p_user_id;
  update public.runway_submissions
    set pet_name = case
          when coalesce(pet_snapshot->>'species', 'dog') = 'cat' then 'Kitty'
          else 'Pup'
        end,
        pet_snapshot = jsonb_set(
          coalesce(pet_snapshot, '{}'::jsonb),
          '{name}',
          to_jsonb(case when coalesce(pet_snapshot->>'species', 'dog') = 'cat' then 'Kitty' else 'Pup' end)
        ),
        player_id = null,
        anonymized = true
    where player_id = p_user_id;
  update public.runway_votes
    set voter_player_id = null
    where voter_player_id = p_user_id;
  delete from public.runway_viewer_hides where player_id = p_user_id;
  update public.runway_invites
    set status = 'declined'
    where player_id = p_user_id and status in ('invited', 'accepted');

  update public.playdates
  set record = public.playdate_scrub_user(record, p_user_id, true),
      initiator_id = null
  where initiator_id = p_user_id;

  update public.playdates p
  set record = public.playdate_scrub_user(p.record, p_user_id, false)
  where exists (
    select 1 from public.playdate_participants pp
    where pp.playdate_id = p.id and pp.player_id = p_user_id and pp.role = 'guest'
  );

  delete from public.playdate_participants where player_id = p_user_id;

  delete from public.playdates p
  where not exists (
    select 1 from public.playdate_participants pp where pp.playdate_id = p.id
  );
end;
$$;

revoke all on function public.delete_friend_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_friend_data(uuid) to service_role;
