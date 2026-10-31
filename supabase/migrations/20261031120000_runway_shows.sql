-- The Catwalk: fashion shows (friend mode + catalogs). Solo shows stay on-device.

create table if not exists public.runway_config (
  id int primary key default 1 check (id = 1),
  version int not null default 1,
  poll_close_minutes int not null default 15,
  drip_first_unlock_minutes int not null default 5,
  drip_next_unlock_minutes int not null default 1,
  max_invites int not null default 5,
  rack_cap int not null default 12
);

insert into public.runway_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.runway_themes (
  id text primary key,
  name text not null,
  venue_asset text not null,
  sort_order int not null default 0
);

create table if not exists public.runway_costumes (
  id text primary key,
  name text not null,
  slot text not null check (slot in ('head', 'face', 'neck', 'body', 'back', 'feet')),
  theme_tags text[] not null default '{}',
  art_asset text,
  colorway jsonb not null default '{"c":"#FFFFFF"}'::jsonb,
  shape text not null default 'piece',
  tags text[] not null default '{}',
  theme_specific boolean not null default false,
  wildcard boolean not null default false
);

create table if not exists public.runway_theme_rack (
  theme_id text not null references public.runway_themes (id) on delete cascade,
  costume_id text not null references public.runway_costumes (id) on delete cascade,
  rack_position int not null,
  primary key (theme_id, costume_id)
);

create table if not exists public.runway_tracks (
  id text primary key,
  title text not null,
  audio_path text not null,
  sort_order int not null default 0
);

create table if not exists public.runway_shows (
  id uuid primary key default gen_random_uuid(),
  host_player_id uuid not null references auth.users (id) on delete set null,
  mode text not null check (mode in ('solo', 'friends')),
  theme_id text not null references public.runway_themes (id),
  track_id text not null references public.runway_tracks (id),
  invites_sent_at timestamptz,
  deadline timestamptz,
  voting_opens_at timestamptz,
  poll_closes_at timestamptz,
  results_revealed_at timestamptz,
  created_at timestamptz not null default now(),
  host_handle text,
  host_anonymized boolean not null default false
);

create table if not exists public.runway_invites (
  show_id uuid not null references public.runway_shows (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined', 'submitted', 'judge', 'withdrawn')),
  submitted boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (show_id, player_id)
);

create table if not exists public.runway_submissions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.runway_shows (id) on delete cascade,
  player_id uuid references auth.users (id) on delete set null,
  pet_snapshot jsonb not null,
  pet_name text not null,
  submitted_at timestamptz not null default now(),
  anonymized boolean not null default false,
  unique (show_id, player_id)
);

create table if not exists public.runway_looks (
  submission_id uuid not null references public.runway_submissions (id) on delete cascade,
  look_number int not null check (look_number between 1 and 3),
  pieces jsonb not null,
  primary key (submission_id, look_number)
);

create table if not exists public.runway_costume_claims (
  show_id uuid not null references public.runway_shows (id) on delete cascade,
  costume_id text not null references public.runway_costumes (id),
  submission_id uuid not null references public.runway_submissions (id) on delete cascade,
  primary key (show_id, costume_id)
);

create table if not exists public.runway_votes (
  show_id uuid not null references public.runway_shows (id) on delete cascade,
  voter_player_id uuid references auth.users (id) on delete set null,
  contestant_submission_id uuid not null references public.runway_submissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, voter_player_id)
);

create table if not exists public.runway_viewer_hides (
  show_id uuid not null references public.runway_shows (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (show_id, player_id)
);

create index if not exists runway_invites_player on public.runway_invites (player_id);
create index if not exists runway_shows_host on public.runway_shows (host_player_id);
create index if not exists runway_submissions_show on public.runway_submissions (show_id);

alter table public.runway_themes enable row level security;
alter table public.runway_costumes enable row level security;
alter table public.runway_theme_rack enable row level security;
alter table public.runway_tracks enable row level security;
alter table public.runway_config enable row level security;
alter table public.runway_shows enable row level security;
alter table public.runway_invites enable row level security;
alter table public.runway_submissions enable row level security;
alter table public.runway_looks enable row level security;
alter table public.runway_costume_claims enable row level security;
alter table public.runway_votes enable row level security;
alter table public.runway_viewer_hides enable row level security;

create policy runway_themes_read on public.runway_themes for select to anon, authenticated using (true);
create policy runway_costumes_read on public.runway_costumes for select to anon, authenticated using (true);
create policy runway_theme_rack_read on public.runway_theme_rack for select to anon, authenticated using (true);
create policy runway_tracks_read on public.runway_tracks for select to anon, authenticated using (true);
create policy runway_config_read on public.runway_config for select to anon, authenticated using (true);

revoke all on table public.runway_shows from public, anon, authenticated;
revoke all on table public.runway_invites from public, anon, authenticated;
revoke all on table public.runway_submissions from public, anon, authenticated;
revoke all on table public.runway_looks from public, anon, authenticated;
revoke all on table public.runway_costume_claims from public, anon, authenticated;
revoke all on table public.runway_votes from public, anon, authenticated;
revoke all on table public.runway_viewer_hides from public, anon, authenticated;
grant all on table public.runway_shows to service_role;
grant all on table public.runway_invites to service_role;
grant all on table public.runway_submissions to service_role;
grant all on table public.runway_looks to service_role;
grant all on table public.runway_costume_claims to service_role;
grant all on table public.runway_votes to service_role;
grant all on table public.runway_viewer_hides to service_role;
grant select on table public.runway_themes to anon, authenticated;
grant select on table public.runway_costumes to anon, authenticated;
grant select on table public.runway_theme_rack to anon, authenticated;
grant select on table public.runway_tracks to anon, authenticated;
grant select on table public.runway_config to anon, authenticated;

-- Seed themes
insert into public.runway_themes (id, name, venue_asset, sort_order) values
  ('space', 'Space Travelers', 'space', 1),
  ('sea', 'Under the Sea', 'sea', 2),
  ('royal', 'Royal Ball', 'royal', 3),
  ('beach', 'Beach Day', 'beach', 4),
  ('winter', 'Winter Wonderland', 'winter', 5),
  ('rock', 'Rock Star', 'rock', 6),
  ('garden', 'Garden Party', 'garden', 7),
  ('spooky', 'Spooky Night', 'spooky', 8),
  ('west', 'Wild West', 'west', 9),
  ('hero', 'Superhero City', 'hero', 10),
  ('pirate', 'Pirate Cove', 'pirate', 11),
  ('safari', 'Safari', 'safari', 12)
on conflict (id) do nothing;

insert into public.runway_tracks (id, title, audio_path, sort_order) values
  ('fashion-show-music', 'Fashion Show', 'absolutesound-fashion-show-music-504647.mp3', 1),
  ('fashion-vogue', 'Fashion Vogue', 'absolutesound-fashion-show-vogue-504648.mp3', 2),
  ('runway-flute', 'Runway Flute', 'astronautflute-fashion-runway-music-554673.mp3', 3),
  ('runway-rebel', 'Runway Rebel', 'bassloom-runway-rebel-553307.mp3', 4),
  ('fashion-runway', 'Fashion Runway', 'bearstockmusic-fashion-runway-586679.mp3', 5),
  ('berry-runway', 'Berry Runway', 'berrydeep-fashion-runway-565396.mp3', 6),
  ('runway-groove', 'Runway Groove', 'echomoodz-runway-groove-246071.mp3', 7),
  ('runway-instrumental', 'Runway Instrumental', 'maison_brava-runway-instrumental-376958.mp3', 8),
  ('runway-royalty', 'Runway Royalty', 'maison_brava-runway-royalty-388307.mp3', 9),
  ('positive-fun', 'Positive Fun', 'musictown-positive-fun-exploration-110144.mp3', 10)
on conflict (id) do nothing;

-- Create a friend show and send invites.
create or replace function public.create_runway_show(
  p_theme_id text,
  p_track_id text,
  p_deadline timestamptz,
  p_invitees uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  show_id uuid;
  invitee uuid;
  max_invites int;
  handle text;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  if p_deadline <= now() then
    return jsonb_build_object('error', 'deadline_past');
  end if;
  select runway_config.max_invites into max_invites from public.runway_config where id = 1;
  if coalesce(array_length(p_invitees, 1), 0) < 1 or coalesce(array_length(p_invitees, 1), 0) > max_invites then
    return jsonb_build_object('error', 'invitees');
  end if;
  if not exists (select 1 from public.runway_themes where id = p_theme_id) then
    return jsonb_build_object('error', 'theme');
  end if;
  if not exists (select 1 from public.runway_tracks where id = p_track_id) then
    return jsonb_build_object('error', 'track');
  end if;
  select handle_lower into handle from public.profiles where user_id = uid;
  insert into public.runway_shows (host_player_id, mode, theme_id, track_id, invites_sent_at, deadline, host_handle)
  values (uid, 'friends', p_theme_id, p_track_id, now(), p_deadline, handle)
  returning id into show_id;
  insert into public.runway_invites (show_id, player_id, status)
  values (show_id, uid, 'accepted');
  foreach invitee in array p_invitees loop
    if invitee = uid then
      continue;
    end if;
    if not exists (
      select 1 from public.friendships f
      where f.user_a_id = least(uid, invitee) and f.user_b_id = greatest(uid, invitee)
    ) then
      continue;
    end if;
    insert into public.runway_invites (show_id, player_id, status)
    values (show_id, invitee, 'invited')
    on conflict do nothing;
  end loop;
  return jsonb_build_object('ok', true, 'show_id', show_id);
end;
$$;

revoke all on function public.create_runway_show(text, text, timestamptz, uuid[]) from public, anon;
grant execute on function public.create_runway_show(text, text, timestamptz, uuid[]) to authenticated;

create or replace function public.respond_runway_invite(p_show_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  if p_action not in ('accept', 'decline') then
    return jsonb_build_object('error', 'action');
  end if;
  update public.runway_invites
    set status = case when p_action = 'accept' then 'accepted' else 'declined' end
  where show_id = p_show_id and player_id = uid and status = 'invited';
  if not found then
    return jsonb_build_object('error', 'invite');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.respond_runway_invite(uuid, text) from public, anon;
grant execute on function public.respond_runway_invite(uuid, text) to authenticated;

create or replace function public.submit_runway_looks(
  p_show_id uuid,
  p_pet_snapshot jsonb,
  p_pet_name text,
  p_looks jsonb,
  p_costume_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  show_row public.runway_shows%rowtype;
  sub_id uuid;
  costume text;
  look jsonb;
  i int;
  waiting int;
  poll_min int;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  select * into show_row from public.runway_shows where id = p_show_id;
  if not found then
    return jsonb_build_object('error', 'show');
  end if;
  if show_row.deadline is not null and show_row.deadline < now() then
    return jsonb_build_object('error', 'closed');
  end if;
  if not exists (
    select 1 from public.runway_invites
    where show_id = p_show_id and player_id = uid and status in ('accepted', 'invited', 'submitted')
  ) and show_row.host_player_id <> uid then
    return jsonb_build_object('error', 'invite');
  end if;
  if exists (select 1 from public.runway_submissions where show_id = p_show_id and player_id = uid) then
    return jsonb_build_object('error', 'already');
  end if;
  foreach costume in array coalesce(p_costume_ids, '{}') loop
    if exists (select 1 from public.runway_costume_claims where show_id = p_show_id and costume_id = costume) then
      return jsonb_build_object('error', 'costume_taken', 'costume_id', costume);
    end if;
  end loop;
  insert into public.runway_submissions (show_id, player_id, pet_snapshot, pet_name)
  values (p_show_id, uid, p_pet_snapshot, p_pet_name)
  returning id into sub_id;
  i := 0;
  for look in select * from jsonb_array_elements(p_looks) loop
    i := i + 1;
    insert into public.runway_looks (submission_id, look_number, pieces)
    values (sub_id, i, look->'pieces');
  end loop;
  foreach costume in array coalesce(p_costume_ids, '{}') loop
    insert into public.runway_costume_claims (show_id, costume_id, submission_id)
    values (p_show_id, costume, sub_id);
  end loop;
  update public.runway_invites
    set status = 'submitted', submitted = true
  where show_id = p_show_id and player_id = uid;
  select count(*) into waiting
  from public.runway_invites
  where show_id = p_show_id and status in ('invited', 'accepted') and submitted = false;
  if waiting = 0 then
    select poll_close_minutes into poll_min from public.runway_config where id = 1;
    update public.runway_shows
      set voting_opens_at = now(),
          poll_closes_at = now() + make_interval(mins => coalesce(poll_min, 15))
    where id = p_show_id and voting_opens_at is null;
  end if;
  return jsonb_build_object('ok', true, 'submission_id', sub_id);
exception
  when unique_violation then
    return jsonb_build_object('error', 'costume_taken');
end;
$$;

revoke all on function public.submit_runway_looks(uuid, jsonb, text, jsonb, text[]) from public, anon;
grant execute on function public.submit_runway_looks(uuid, jsonb, text, jsonb, text[]) to authenticated;

create or replace function public.cast_runway_vote(p_show_id uuid, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  show_row public.runway_shows%rowtype;
  voters int;
  votes int;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  select * into show_row from public.runway_shows where id = p_show_id;
  if not found then
    return jsonb_build_object('error', 'show');
  end if;
  if show_row.voting_opens_at is null or show_row.voting_opens_at > now() then
    return jsonb_build_object('error', 'closed');
  end if;
  if show_row.poll_closes_at is not null and show_row.poll_closes_at < now() then
    return jsonb_build_object('error', 'closed');
  end if;
  if not exists (
    select 1 from public.runway_invites
    where show_id = p_show_id and player_id = uid and status in ('accepted', 'submitted', 'judge', 'invited')
  ) and show_row.host_player_id <> uid then
    return jsonb_build_object('error', 'invite');
  end if;
  if not exists (select 1 from public.runway_submissions where id = p_submission_id and show_id = p_show_id) then
    return jsonb_build_object('error', 'contestant');
  end if;
  insert into public.runway_votes (show_id, voter_player_id, contestant_submission_id)
  values (p_show_id, uid, p_submission_id);
  select count(*) into voters
  from public.runway_invites
  where show_id = p_show_id and status in ('accepted', 'submitted', 'judge');
  select count(*) into votes from public.runway_votes where show_id = p_show_id;
  if votes >= voters then
    update public.runway_shows set results_revealed_at = now() where id = p_show_id and results_revealed_at is null;
  end if;
  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('error', 'voted');
end;
$$;

revoke all on function public.cast_runway_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_runway_vote(uuid, uuid) to authenticated;

create or replace function public.hide_runway_show(p_show_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  remaining int;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  insert into public.runway_viewer_hides (show_id, player_id)
  values (p_show_id, uid)
  on conflict do nothing;
  select count(*) into remaining
  from public.runway_invites i
  where i.show_id = p_show_id
    and i.status in ('accepted', 'submitted', 'judge', 'invited')
    and not exists (
      select 1 from public.runway_viewer_hides h where h.show_id = i.show_id and h.player_id = i.player_id
    );
  if remaining = 0 then
    delete from public.runway_shows where id = p_show_id;
  end if;
  return jsonb_build_object('ok', true, 'deleted', remaining = 0);
end;
$$;

revoke all on function public.hide_runway_show(uuid) from public, anon;
grant execute on function public.hide_runway_show(uuid) to authenticated;

create or replace function public.open_runway_voting_if_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_min int;
begin
  select poll_close_minutes into poll_min from public.runway_config where id = 1;
  update public.runway_invites i
    set status = 'judge'
  from public.runway_shows s
  where i.show_id = s.id
    and s.deadline is not null
    and s.deadline <= now()
    and s.voting_opens_at is null
    and i.submitted = false
    and i.status in ('invited', 'accepted');
  update public.runway_shows s
    set voting_opens_at = now(),
        poll_closes_at = now() + make_interval(mins => coalesce(poll_min, 15))
  where s.deadline is not null
    and s.deadline <= now()
    and s.voting_opens_at is null;
  update public.runway_shows
    set results_revealed_at = coalesce(results_revealed_at, now())
  where poll_closes_at is not null
    and poll_closes_at <= now()
    and results_revealed_at is null;
end;
$$;

revoke all on function public.open_runway_voting_if_due() from public, anon, authenticated;
grant execute on function public.open_runway_voting_if_due() to service_role;

-- Anonymize runway rows when an account is deleted. Keep shows and tallies.
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
