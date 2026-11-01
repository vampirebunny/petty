-- Friend-show submit-by choices are 30 min, 1 hour, and 24 hours.
-- The shortest choice is 30 minutes, so the create check matches.

update public.runway_config
set min_deadline_minutes = 30
where id = 1;

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
  min_deadline int;
  handle text;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  if p_deadline <= now() then
    return jsonb_build_object('error', 'deadline_past');
  end if;
  select runway_config.max_invites, runway_config.min_deadline_minutes
    into max_invites, min_deadline
  from public.runway_config where id = 1;
  if p_deadline < now() + make_interval(mins => coalesce(min_deadline, 30)) then
    return jsonb_build_object('error', 'deadline_too_soon');
  end if;
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
