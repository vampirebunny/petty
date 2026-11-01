-- Read a friend show the caller is in. Show tables stay closed to SELECT;
-- these security-definer functions are the only client read path.

create or replace function public.get_runway_show(p_show_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  show_row public.runway_shows%rowtype;
  mine public.runway_invites%rowtype;
  can_peek boolean;
  my_vote uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  select * into show_row from public.runway_shows where id = p_show_id;
  if not found then
    return jsonb_build_object('error', 'show');
  end if;
  select * into mine from public.runway_invites where show_id = p_show_id and player_id = uid;
  if show_row.host_player_id <> uid and not found then
    return jsonb_build_object('error', 'invite');
  end if;
  if exists (select 1 from public.runway_viewer_hides h where h.show_id = p_show_id and h.player_id = uid) then
    return jsonb_build_object('error', 'show');
  end if;

  select v.contestant_submission_id into my_vote
  from public.runway_votes v
  where v.show_id = p_show_id and v.voter_player_id = uid;

  -- No peeking at other looks until you have submitted, the deadline has made you a judge,
  -- or voting / results are open.
  can_peek :=
    coalesce(mine.submitted, false)
    or coalesce(mine.status, '') = 'judge'
    or (show_row.deadline is not null and show_row.deadline <= now() and not coalesce(mine.submitted, false))
    or (show_row.voting_opens_at is not null and show_row.voting_opens_at <= now())
    or show_row.results_revealed_at is not null;

  return jsonb_build_object(
    'ok', true,
    'id', show_row.id,
    'theme_id', show_row.theme_id,
    'track_id', show_row.track_id,
    'host_player_id', show_row.host_player_id,
    'host_handle', coalesce(show_row.host_handle, ''),
    'am_host', show_row.host_player_id = uid,
    'invites_sent_at', show_row.invites_sent_at,
    'deadline', show_row.deadline,
    'voting_opens_at', show_row.voting_opens_at,
    'poll_closes_at', show_row.poll_closes_at,
    'results_revealed_at', show_row.results_revealed_at,
    'created_at', show_row.created_at,
    'my_status', coalesce(mine.status, 'accepted'),
    'my_vote_submission_id', my_vote,
    'can_peek', can_peek,
    'claimed_costume_ids', coalesce((
      select jsonb_agg(c.costume_id) from public.runway_costume_claims c where c.show_id = p_show_id
    ), '[]'::jsonb),
    'contestants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', i.player_id,
        'handle', coalesce(p.handle_lower, case when i.player_id = show_row.host_player_id then show_row.host_handle else 'friend' end),
        'pet_name', sub.pet_name,
        'status', i.status,
        'submitted', i.submitted,
        'submission_id', sub.id,
        'is_me', i.player_id = uid,
        'vote_count', case
          when show_row.results_revealed_at is null then null
          else coalesce((select count(*) from public.runway_votes vv where vv.show_id = p_show_id and vv.contestant_submission_id = sub.id), 0)
        end
      ) order by (i.player_id = uid) desc, i.submitted desc, i.created_at)
      from public.runway_invites i
      left join public.profiles p on p.user_id = i.player_id
      left join public.runway_submissions sub on sub.show_id = i.show_id and sub.player_id = i.player_id
      where i.show_id = p_show_id and i.status not in ('declined', 'withdrawn')
    ), '[]'::jsonb),
    'submissions', case when not can_peek then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'submission_id', sub.id,
        'player_id', sub.player_id,
        'pet_name', sub.pet_name,
        'pet_snapshot', sub.pet_snapshot,
        'submitted_at', sub.submitted_at,
        'claimed_costume_ids', coalesce((
          select jsonb_agg(c.costume_id) from public.runway_costume_claims c where c.submission_id = sub.id
        ), '[]'::jsonb),
        'looks', coalesce((
          select jsonb_agg(jsonb_build_object('look_number', l.look_number, 'pieces', l.pieces) order by l.look_number)
          from public.runway_looks l where l.submission_id = sub.id
        ), '[]'::jsonb)
      ) order by sub.submitted_at)
      from public.runway_submissions sub
      where sub.show_id = p_show_id
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.get_runway_show(uuid) from public, anon;
grant execute on function public.get_runway_show(uuid) to authenticated;

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
          ), '[]'::jsonb) end
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
