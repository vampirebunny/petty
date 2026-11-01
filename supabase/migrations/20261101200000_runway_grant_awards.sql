-- Wire grant_runway_awards into friend show RPCs and persist a solo walk
-- so grants have a show_id. Walked/hosted keys make retries a no-op on counters.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.award_json_for_player(p_rows jsonb, p_player uuid)
returns jsonb
language sql
immutable
as $$
  select coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) item
    where item->>'player_id' = p_player::text
  ), '[]'::jsonb);
$$;

create or replace function public.award_walk_pet(
  p_show uuid,
  p_theme text,
  p_player uuid,
  p_pet uuid,
  p_snapshot jsonb,
  p_submission uuid,
  p_friend boolean,
  p_local_day text,
  p_version int
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  granted uuid[] := '{}';
  extra uuid[];
  new_id uuid;
  counted boolean := true;
  already boolean;
  day_count numeric;
  walked numeric;
  theme_walked numeric;
  shows numeric;
begin
  if p_pet is null or p_player is null then
    return granted;
  end if;
  if exists (select 1 from public.pets where id = p_pet and status = 'retired') and p_player is null then
    return granted;
  end if;

  perform public.award_record_look_pieces(p_pet, p_theme, p_submission);
  already := coalesce(public.award_progress_value(p_player, p_pet, 'walked:' || p_show::text), 0) >= 1;

  new_id := public.award_try_insert(
    p_player, p_pet, 'stamp_' || p_theme || '_debut', p_snapshot, 'runway', null, p_show, null, p_version
  );
  if new_id is not null then granted := granted || new_id; end if;

  if p_friend then
    new_id := public.award_try_insert(
      p_player, p_pet, 'stamp_' || p_theme || '_party', p_snapshot, 'runway', null, p_show, null, p_version
    );
    if new_id is not null then granted := granted || new_id; end if;
  end if;

  if public.award_check_full_rack(p_pet, p_theme) then
    new_id := public.award_try_insert(
      p_player, p_pet, 'stamp_' || p_theme || '_rack', p_snapshot, 'runway', null, p_show, null, p_version
    );
    if new_id is not null then granted := granted || new_id; end if;
  end if;

  extra := public.award_check_lookbook(p_player, p_pet, p_snapshot, p_show, p_version);
  granted := granted || extra;
  extra := public.award_lifetime_collector(p_player, p_version);
  granted := granted || extra;

  if already then
    return granted;
  end if;
  perform public.award_set_progress(p_player, p_pet, 'walked:' || p_show::text, 1);

  if not p_friend then
    day_count := public.award_add_progress(p_player, p_pet, 'solo_shows_on:' || p_local_day, 1);
    counted := day_count <= 3;
  end if;

  if counted then
    walked := public.award_add_progress(p_player, p_pet, 'shows_walked', 1);
    theme_walked := public.award_add_progress(p_player, p_pet, 'shows_walked:' || p_theme, 1);
    extra := public.award_grant_thresholds(
      p_player, p_pet, p_snapshot, 'runway', null, p_show, 'covers', 'cover_',
      walked, array[5, 15, 40, 100], array['bronze', 'silver', 'gold', 'platinum'], p_version
    );
    granted := granted || extra;
    if theme_walked >= 5 then
      new_id := public.award_try_insert(
        p_player, p_pet, 'stamp_' || p_theme || '_encore', p_snapshot, 'runway', null, p_show, null, p_version
      );
      if new_id is not null then granted := granted || new_id; end if;
    end if;
    shows := public.award_add_progress(p_player, null, 'lifetime_shows', 1);
    extra := public.award_grant_thresholds(
      p_player, null, p_snapshot, 'runway', null, p_show, 'lifetime', 'lifetime_shows_',
      shows, array[50, 200, 500], array['bronze', 'silver', 'gold'], p_version
    );
    granted := granted || extra;
  end if;

  return granted;
end;
$$;

create or replace function public.grant_runway_awards(p_show_id uuid, p_event text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.awards_config%rowtype;
  showrow public.runway_shows%rowtype;
  granted uuid[] := '{}';
  extra uuid[];
  new_id uuid;
  local_day text;
  actor uuid;
  petrow public.pets%rowtype;
  snap jsonb;
  sub public.runway_submissions%rowtype;
  other uuid;
  friend_n numeric;
  hosted numeric;
  front numeric;
  max_votes int;
  pet_id uuid;
begin
  select * into cfg from public.awards_config where id = 1;
  select * into showrow from public.runway_shows where id = p_show_id;
  if not found then
    return '[]'::jsonb;
  end if;
  local_day := coalesce(p_payload->>'local_day', to_char(timezone('utc', now()), 'YYYY-MM-DD'));
  actor := coalesce((p_payload->>'player_id')::uuid, auth.uid());

  if p_event in ('solo_walked', 'friend_walked') then
    for sub in select * from public.runway_submissions where show_id = p_show_id and player_id is not null loop
      pet_id := coalesce((sub.pet_snapshot->>'id')::uuid, (sub.pet_snapshot->>'petId')::uuid);
      if pet_id is null then
        select id into pet_id from public.pets where owner_user_id = sub.player_id and status = 'active' limit 1;
      end if;
      select * into petrow from public.pets where id = pet_id;
      snap := coalesce(sub.pet_snapshot, public.award_doc_snapshot(petrow));
      extra := public.award_walk_pet(
        p_show_id, showrow.theme_id, sub.player_id, pet_id, snap, sub.id,
        p_event = 'friend_walked', local_day, cfg.config_version
      );
      granted := granted || extra;

      if p_event = 'friend_walked' then
        for other in
          select distinct s.player_id from public.runway_submissions s
          where s.show_id = p_show_id and s.player_id is not null and s.player_id <> sub.player_id
        loop
          perform public.award_set_progress(sub.player_id, pet_id, 'runway_friend:' || other::text, 1);
        end loop;
        select count(*) into friend_n
        from public.award_progress
        where player_id = sub.player_id and pet_id is not distinct from pet_id and counter_key like 'runway_friend:%';
        extra := public.award_grant_thresholds(
          sub.player_id, pet_id, snap, 'runway', null, p_show_id, 'friends', 'friend_crew_',
          friend_n, array[3, 10, 25], array['bronze', 'silver', 'gold'], cfg.config_version
        );
        granted := granted || extra;
      end if;
    end loop;

    if p_event = 'friend_walked'
      and (select count(*) from public.runway_submissions where show_id = p_show_id and player_id is not null and player_id <> showrow.host_player_id) >= 1
    then
      select * into petrow from public.pets where owner_user_id = showrow.host_player_id and status = 'active' limit 1;
      if found and coalesce(public.award_progress_value(showrow.host_player_id, petrow.id, 'hosted:' || p_show_id::text), 0) < 1 then
        perform public.award_set_progress(showrow.host_player_id, petrow.id, 'hosted:' || p_show_id::text, 1);
        snap := public.award_doc_snapshot(petrow);
        hosted := public.award_add_progress(showrow.host_player_id, petrow.id, 'hosted', 1);
        extra := public.award_grant_thresholds(
          showrow.host_player_id, petrow.id, snap, 'runway', null, p_show_id, 'friends', 'friend_host_',
          hosted, array[1, 5, 15], array['bronze', 'silver', 'gold'], cfg.config_version
        );
        granted := granted || extra;
      end if;
    end if;
  elsif p_event = 'vote_cast' then
    if actor is null then
      return '[]'::jsonb;
    end if;
    if coalesce(public.award_progress_value(actor, null, 'voted:' || p_show_id::text), 0) >= 1 then
      return '[]'::jsonb;
    end if;
    perform public.award_set_progress(actor, null, 'voted:' || p_show_id::text, 1);
    select * into petrow from public.pets
    where owner_user_id = actor and status = 'active'
    limit 1;
    if not found then
      return '[]'::jsonb;
    end if;
    snap := public.award_doc_snapshot(petrow);
    front := public.award_add_progress(actor, petrow.id, 'front_row', 1);
    extra := public.award_grant_thresholds(
      actor, petrow.id, snap, 'runway', null, p_show_id, 'friends', 'friend_front_',
      front, array[10, 30, 75], array['bronze', 'silver', 'gold'], cfg.config_version
    );
    granted := granted || extra;
  elsif p_event = 'results_published' then
    select coalesce(max(c), 0) into max_votes
    from (
      select count(*) as c from public.runway_votes where show_id = p_show_id group by contestant_submission_id
    ) t;
    if max_votes < 1 then
      return '[]'::jsonb;
    end if;
    for sub in
      select s.*
      from public.runway_submissions s
      join (
        select contestant_submission_id, count(*) as c
        from public.runway_votes
        where show_id = p_show_id
        group by contestant_submission_id
      ) v on v.contestant_submission_id = s.id
      where s.show_id = p_show_id and s.player_id is not null and v.c = max_votes
    loop
      pet_id := coalesce((sub.pet_snapshot->>'id')::uuid, (sub.pet_snapshot->>'petId')::uuid);
      if pet_id is null then
        select id into pet_id from public.pets where owner_user_id = sub.player_id and status = 'active' limit 1;
      end if;
      snap := coalesce(sub.pet_snapshot, '{}'::jsonb);
      new_id := public.award_try_insert(
        sub.player_id, pet_id, 'crowd_favorite', snap, 'runway', null, p_show_id, null, cfg.config_version
      );
      if new_id is not null then granted := granted || new_id; end if;
      new_id := public.award_try_insert(
        sub.player_id, pet_id, 'stamp_' || showrow.theme_id || '_star', snap, 'runway', null, p_show_id, null, cfg.config_version
      );
      if new_id is not null then granted := granted || new_id; end if;
    end loop;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(a) order by a.earned_at)
    from public.awards a
    where a.id = any (granted)
  ), '[]'::jsonb);
end;
$$;

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
  granted jsonb := '[]'::jsonb;
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
  if voting_opened then
    granted := public.award_json_for_player(
      public.grant_runway_awards(p_show_id, 'friend_walked', jsonb_build_object('player_id', uid)),
      uid
    );
  end if;
  return jsonb_build_object('ok', true, 'submission_id', sub_id, 'voting_opened', voting_opened, 'awards', granted);
exception
  when unique_violation then
    return jsonb_build_object('error', 'costume_taken');
end;
$$;

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
  granted jsonb := '[]'::jsonb;
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
  granted := public.award_json_for_player(
    public.grant_runway_awards(p_show_id, 'vote_cast', jsonb_build_object('player_id', uid)),
    uid
  );
  if revealed then
    granted := granted || public.award_json_for_player(
      public.grant_runway_awards(p_show_id, 'results_published', jsonb_build_object('player_id', uid)),
      uid
    );
  end if;
  return jsonb_build_object('ok', true, 'results_revealed', revealed, 'awards', granted);
exception
  when unique_violation then
    return jsonb_build_object('error', 'voted');
end;
$$;

create or replace function public.open_runway_voting_if_due()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_min int;
  opened uuid;
  revealed uuid;
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
  for opened in
    update public.runway_shows s
      set voting_opens_at = now(),
          poll_closes_at = now() + make_interval(mins => coalesce(poll_min, 15))
    where s.deadline is not null
      and s.deadline <= now()
      and s.voting_opens_at is null
    returning s.id
  loop
    perform public.grant_runway_awards(opened, 'friend_walked', '{}'::jsonb);
  end loop;
  for revealed in
    update public.runway_shows
      set results_revealed_at = now()
    where poll_closes_at is not null
      and poll_closes_at <= now()
      and results_revealed_at is null
    returning id
  loop
    perform public.grant_runway_awards(revealed, 'results_published', '{}'::jsonb);
  end loop;
end;
$$;

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

  perform public.open_runway_voting_if_due();
  select * into show_row from public.runway_shows where id = p_show_id;
  select * into mine from public.runway_invites where show_id = p_show_id and player_id = uid;

  select v.contestant_submission_id into my_vote
  from public.runway_votes v
  where v.show_id = p_show_id and v.voter_player_id = uid;

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
    ), '[]'::jsonb) end,
    'awards', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.earned_at)
      from public.awards a
      where a.show_id = p_show_id and a.player_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

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
          and s.mode <> 'solo'
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

create or replace function public.record_solo_runway_walk(
  p_theme_id text,
  p_track_id text,
  p_pet_id uuid,
  p_pet_snapshot jsonb,
  p_looks jsonb,
  p_local_day text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  show_id uuid;
  sub_id uuid;
  look jsonb;
  i int;
  snap jsonb;
  granted jsonb;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  if not exists (select 1 from public.pets where id = p_pet_id and owner_user_id = uid and status = 'active') then
    return jsonb_build_object('error', 'pet');
  end if;
  if not exists (select 1 from public.runway_themes where id = p_theme_id) then
    return jsonb_build_object('error', 'theme');
  end if;
  if not exists (select 1 from public.runway_tracks where id = p_track_id) then
    return jsonb_build_object('error', 'track');
  end if;
  snap := coalesce(p_pet_snapshot, '{}'::jsonb) || jsonb_build_object('id', p_pet_id, 'petId', p_pet_id);
  insert into public.runway_shows (host_player_id, mode, theme_id, track_id, host_handle)
  values (
    uid,
    'solo',
    p_theme_id,
    p_track_id,
    (select handle_lower from public.profiles where user_id = uid)
  )
  returning id into show_id;
  insert into public.runway_submissions (show_id, player_id, pet_snapshot, pet_name)
  values (show_id, uid, snap, coalesce(snap->>'name', 'Pet'))
  returning id into sub_id;
  i := 0;
  for look in select * from jsonb_array_elements(coalesce(p_looks, '[]'::jsonb)) loop
    i := i + 1;
    insert into public.runway_looks (submission_id, look_number, pieces)
    values (sub_id, i, coalesce(look->'pieces', '[]'::jsonb));
  end loop;
  granted := public.award_json_for_player(
    public.grant_runway_awards(
      show_id,
      'solo_walked',
      jsonb_build_object(
        'local_day', coalesce(nullif(p_local_day, ''), to_char(timezone('utc', now()), 'YYYY-MM-DD')),
        'player_id', uid
      )
    ),
    uid
  );
  return jsonb_build_object('ok', true, 'show_id', show_id, 'awards', granted);
end;
$$;

revoke all on function public.award_json_for_player(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.award_walk_pet(uuid, text, uuid, uuid, jsonb, uuid, boolean, text, int) from public, anon, authenticated;
revoke all on function public.grant_runway_awards(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.open_runway_voting_if_due() from public, anon, authenticated;
revoke all on function public.submit_runway_looks(uuid, jsonb, text, jsonb, text[]) from public, anon;
revoke all on function public.cast_runway_vote(uuid, uuid) from public, anon;
revoke all on function public.get_runway_show(uuid) from public, anon;
revoke all on function public.list_my_runway_shows() from public, anon;
revoke all on function public.record_solo_runway_walk(text, text, uuid, jsonb, jsonb, text) from public, anon;

grant execute on function public.grant_runway_awards(uuid, text, jsonb) to service_role;
grant execute on function public.open_runway_voting_if_due() to service_role;
grant execute on function public.submit_runway_looks(uuid, jsonb, text, jsonb, text[]) to authenticated;
grant execute on function public.cast_runway_vote(uuid, uuid) to authenticated;
grant execute on function public.get_runway_show(uuid) to authenticated;
grant execute on function public.list_my_runway_shows() to authenticated;
grant execute on function public.record_solo_runway_walk(text, text, uuid, jsonb, jsonb, text) to authenticated;
