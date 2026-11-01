-- The last submission reports whether it opened voting, the last vote reports
-- whether it revealed results, and the show list says if this player already voted
-- plus the vote totals once results are in.

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
  voting_opened boolean := false;
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
    voting_opened := found;
  end if;
  return jsonb_build_object('ok', true, 'submission_id', sub_id, 'voting_opened', voting_opened);
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
  revealed boolean := false;
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
    revealed := found;
  end if;
  return jsonb_build_object('ok', true, 'results_revealed', revealed);
exception
  when unique_violation then
    return jsonb_build_object('error', 'voted');
end;
$$;

revoke all on function public.cast_runway_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_runway_vote(uuid, uuid) to authenticated;

create or replace function public.list_my_runway_shows()
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
  return jsonb_build_object(
    'ok', true,
    'shows', coalesce((
      select jsonb_agg(item order by (item->>'created_at') desc)
      from (
        select jsonb_build_object(
          'id', s.id,
          'theme_id', s.theme_id,
          'track_id', s.track_id,
          'host_handle', coalesce(s.host_handle, ''),
          'my_status', coalesce(i.status, 'accepted'),
          'deadline', s.deadline,
          'voting_opens_at', s.voting_opens_at,
          'poll_closes_at', s.poll_closes_at,
          'results_revealed_at', s.results_revealed_at,
          'created_at', s.created_at,
          'am_host', s.host_player_id = uid,
          'contestant_count', (
            select count(*) from public.runway_invites x
            where x.show_id = s.id and x.status in ('invited', 'accepted', 'submitted', 'judge')
          ),
          'submitted_count', (
            select count(*) from public.runway_invites x
            where x.show_id = s.id and x.submitted
          ),
          'winner_handles', case when s.results_revealed_at is null then '[]'::jsonb else coalesce((
            select jsonb_agg(w.handle)
            from (
              select coalesce(pr.handle_lower, sub.pet_name) as handle, count(*) as n
              from public.runway_votes v
              join public.runway_submissions sub on sub.id = v.contestant_submission_id
              left join public.profiles pr on pr.user_id = sub.player_id
              where v.show_id = s.id
              group by 1
            ) w
            where w.n = (
              select max(n2) from (
                select count(*) as n2 from public.runway_votes v2
                where v2.show_id = s.id
                group by v2.contestant_submission_id
              ) m
            )
          ), '[]'::jsonb) end,
          'standings', case when s.results_revealed_at is null then '[]'::jsonb else coalesce((
            select jsonb_agg(jsonb_build_object('handle', w.handle, 'votes', w.n) order by w.n desc, w.handle)
            from (
              select coalesce(pr.handle_lower, sub.pet_name, 'friend') as handle, count(v.id) as n
              from public.runway_submissions sub
              left join public.runway_votes v on v.contestant_submission_id = sub.id and v.show_id = s.id
              left join public.profiles pr on pr.user_id = sub.player_id
              where sub.show_id = s.id
              group by sub.id, pr.handle_lower, sub.pet_name
            ) w
          ), '[]'::jsonb) end,
          'voted', exists (
            select 1 from public.runway_votes v
            where v.show_id = s.id and v.voter_player_id = uid
          )
        ) as item
        from public.runway_shows s
        left join public.runway_invites i on i.show_id = s.id and i.player_id = uid
        where (s.host_player_id = uid or i.player_id = uid)
          and coalesce(i.status, 'accepted') <> 'declined'
          and coalesce(i.status, 'accepted') <> 'withdrawn'
          and not exists (
            select 1 from public.runway_viewer_hides h where h.show_id = s.id and h.player_id = uid
          )
      ) listed
    ), '[]'::jsonb),
    'recent_invitees', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', q.player_id, 'handle', q.handle) order by q.last_at desc)
      from (
        select i.player_id, p.handle_lower as handle, max(s.created_at) as last_at
        from public.runway_shows s
        join public.runway_invites i on i.show_id = s.id and i.player_id <> uid
        join public.profiles p on p.user_id = i.player_id
        where s.host_player_id = uid
        group by i.player_id, p.handle_lower
        order by max(s.created_at) desc
        limit 5
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_my_runway_shows() from public, anon;
grant execute on function public.list_my_runway_shows() to authenticated;
