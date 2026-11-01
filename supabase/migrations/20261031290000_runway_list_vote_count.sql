-- Vote rows have no id column; count the voted submission instead so the show list loads.

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
              select coalesce(pr.handle_lower, sub.pet_name, 'friend') as handle, count(v.contestant_submission_id) as n
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
