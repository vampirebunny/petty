-- Stay keeps one closest hold per account. Apply this yourself; it does not delete users.

create table public.stay_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_cs integer not null check (target_cs between 500 and 1500 and target_cs % 100 = 0),
  actual_cs integer not null check (actual_cs >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stay_scores_rank_idx on public.stay_scores ((abs(actual_cs - target_cs)), updated_at);

create table public.stay_submit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index stay_submit_log_user_idx on public.stay_submit_log (user_id, created_at desc);

alter table public.stay_scores enable row level security;
alter table public.stay_submit_log enable row level security;

revoke all on public.stay_scores, public.stay_submit_log from public, anon, authenticated;

create or replace function public.submit_stay_time(p_target_cs integer, p_actual_cs integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  handle text;
  existing public.stay_scores%rowtype;
  recent integer;
  rank integer;
  kept_target integer;
  kept_actual integer;
  kept_at timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select profiles.handle into handle from public.profiles where user_id = uid;
  if handle is null then
    return jsonb_build_object('ok', false, 'error', 'no_handle');
  end if;
  if p_target_cs is null or p_actual_cs is null
     or p_target_cs < 500 or p_target_cs > 1500 or p_target_cs % 100 <> 0
     or p_actual_cs < 0 then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;

  select * into existing from public.stay_scores where user_id = uid;
  if found and abs(existing.actual_cs - existing.target_cs) <= abs(p_actual_cs - p_target_cs) then
    select count(*)::int + 1 into rank
    from public.stay_scores s
    join public.profiles on profiles.user_id = s.user_id
    where s.user_id <> uid
      and (
        abs(s.actual_cs - s.target_cs) < abs(existing.actual_cs - existing.target_cs)
        or (
          abs(s.actual_cs - s.target_cs) = abs(existing.actual_cs - existing.target_cs)
          and s.updated_at < existing.updated_at
        )
      );
    return jsonb_build_object(
      'ok', true,
      'updated', false,
      'rank', rank,
      'targetCs', existing.target_cs,
      'actualCs', existing.actual_cs
    );
  end if;

  select count(*)::int into recent
  from public.stay_submit_log
  where user_id = uid and created_at > now() - interval '10 minutes';
  if recent >= 12 then
    return jsonb_build_object('ok', false, 'error', 'rate_limit');
  end if;

  insert into public.stay_submit_log (user_id) values (uid);
  insert into public.stay_scores (user_id, target_cs, actual_cs)
  values (uid, p_target_cs, p_actual_cs)
  on conflict (user_id) do update set
    target_cs = excluded.target_cs,
    actual_cs = excluded.actual_cs,
    updated_at = now()
  where abs(public.stay_scores.actual_cs - public.stay_scores.target_cs) > abs(excluded.actual_cs - excluded.target_cs);

  kept_target := p_target_cs;
  kept_actual := p_actual_cs;
  kept_at := now();

  select count(*)::int + 1 into rank
  from public.stay_scores s
  join public.profiles on profiles.user_id = s.user_id
  where s.user_id <> uid
    and (
      abs(s.actual_cs - s.target_cs) < abs(kept_actual - kept_target)
      or (
        abs(s.actual_cs - s.target_cs) = abs(kept_actual - kept_target)
        and s.updated_at < kept_at
      )
    );

  return jsonb_build_object(
    'ok', true,
    'updated', true,
    'rank', rank,
    'targetCs', kept_target,
    'actualCs', kept_actual
  );
end;
$$;

create or replace function public.stay_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rows jsonb;
  me jsonb;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  select coalesce(jsonb_agg(to_jsonb(board) order by board.rank), '[]'::jsonb)
  into rows
  from (
    select
      ranked.rank,
      ranked.handle,
      ranked.target_cs as "targetCs",
      ranked.actual_cs as "actualCs",
      ranked.user_id = uid as mine
    from (
      select
        scores.user_id,
        scores.target_cs,
        scores.actual_cs,
        profiles.handle,
        row_number() over (
          order by abs(scores.actual_cs - scores.target_cs) asc, scores.updated_at asc
        ) as rank
      from public.stay_scores scores
      join public.profiles on profiles.user_id = scores.user_id
    ) ranked
    where ranked.rank <= 20
  ) board;

  select jsonb_build_object(
    'rank', ranked.rank,
    'handle', ranked.handle,
    'targetCs', ranked.target_cs,
    'actualCs', ranked.actual_cs
  )
  into me
  from (
    select
      scores.user_id,
      scores.target_cs,
      scores.actual_cs,
      profiles.handle,
      row_number() over (
        order by abs(scores.actual_cs - scores.target_cs) asc, scores.updated_at asc
      ) as rank
    from public.stay_scores scores
    join public.profiles on profiles.user_id = scores.user_id
  ) ranked
  where ranked.user_id = uid;

  return jsonb_build_object('ok', true, 'rows', rows, 'me', me);
end;
$$;

revoke all on function public.submit_stay_time(integer, integer) from public, anon;
revoke all on function public.stay_leaderboard() from public, anon;
grant execute on function public.submit_stay_time(integer, integer) to authenticated;
grant execute on function public.stay_leaderboard() to authenticated;
