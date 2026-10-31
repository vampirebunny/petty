-- Friends currently in the park. Apply this yourself; it does not delete users.
-- One row per linked player while their park scene is open. Friends read it through RLS.
-- Postgres Changes delivers those rows. Public Realtime access stays on for stadium channels.

create table public.park_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  pet jsonb not null,
  entered_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table public.park_presence replica identity full;
alter table public.friendships replica identity full;
alter table public.blocks replica identity full;

alter table public.park_presence enable row level security;

revoke all on public.park_presence from public, anon, authenticated;
grant select on public.park_presence to authenticated;
grant select on public.friendships to authenticated;
grant select on public.blocks to authenticated;

create policy park_presence_select on public.park_presence
  for select to authenticated
  using (
    not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true)
    and (
      user_id = (select auth.uid())
      or (
        exists (
          select 1 from public.friendships f
          where f.user_a_id = least((select auth.uid()), user_id)
            and f.user_b_id = greatest((select auth.uid()), user_id)
        )
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = (select auth.uid()) and b.blocked_id = user_id)
             or (b.blocked_id = (select auth.uid()) and b.blocker_id = user_id)
        )
      )
    )
  );

create policy friendships_select_own on public.friendships
  for select to authenticated
  using (
    not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true)
    and (user_a_id = (select auth.uid()) or user_b_id = (select auth.uid()))
  );

create policy blocks_select_involved on public.blocks
  for select to authenticated
  using (
    not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true)
    and (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()))
  );

create or replace function public.park_presence_sweep()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.park_presence where last_seen < now() - interval '90 seconds';
$$;

revoke all on function public.park_presence_sweep() from public, anon, authenticated;

create or replace function public.park_presence_enter(p_handle text, p_pet jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  rows jsonb;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_handle is null or length(trim(p_handle)) = 0 or p_pet is null or jsonb_typeof(p_pet) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad_pet');
  end if;
  perform public.park_presence_sweep();
  insert into public.park_presence (user_id, handle, pet, entered_at, last_seen)
  values (uid, trim(p_handle), p_pet, now(), now())
  on conflict (user_id) do update
    set handle = excluded.handle,
        pet = excluded.pet,
        last_seen = now();
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id,
    'handle', p.handle,
    'pet', p.pet,
    'enteredAt', p.entered_at,
    'lastSeen', p.last_seen
  )), '[]'::jsonb) into rows
  from public.park_presence p
  where p.user_id <> uid
    and p.last_seen >= now() - interval '90 seconds'
    and public.friend_game_are_friends(uid, p.user_id);
  return jsonb_build_object('ok', true, 'rows', rows);
end;
$$;

create or replace function public.park_presence_touch()
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
  perform public.park_presence_sweep();
  update public.park_presence set last_seen = now() where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.park_presence_pet(p_pet jsonb)
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
  if p_pet is null or jsonb_typeof(p_pet) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad_pet');
  end if;
  update public.park_presence
    set pet = p_pet, last_seen = now()
    where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.park_presence_leave()
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
  delete from public.park_presence where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.park_presence_enter(text, jsonb) from public, anon;
revoke all on function public.park_presence_touch() from public, anon;
revoke all on function public.park_presence_pet(jsonb) from public, anon;
revoke all on function public.park_presence_leave() from public, anon;
grant execute on function public.park_presence_enter(text, jsonb) to authenticated;
grant execute on function public.park_presence_touch() to authenticated;
grant execute on function public.park_presence_pet(jsonb) to authenticated;
grant execute on function public.park_presence_leave() to authenticated;

do $$
declare
  name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach name in array array['park_presence', 'friendships', 'blocks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', name);
    end if;
  end loop;
end $$;

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
end;
$$;

revoke all on function public.delete_friend_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_friend_data(uuid) to service_role;
