-- Acorn Attack keeps every finished run. Apply this yourself; it does not delete users.
-- A flagged row stays stored and is left off the friends board.

create table public.acorn_attack_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null,
  score integer not null check (score >= 0),
  level integer not null check (level >= 1),
  distance_m integer not null check (distance_m >= 0),
  squirrels integer not null check (squirrels >= 0),
  treats integer not null check (treats >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  client_version text not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint acorn_attack_scores_run_once unique (run_id)
);

create index acorn_attack_scores_rank_idx on public.acorn_attack_scores (player_id, score desc);

alter table public.acorn_attack_scores enable row level security;

revoke all on public.acorn_attack_scores from public, anon, authenticated;

create or replace function public.submit_acorn_attack_score(
  p_run_id uuid,
  p_score integer,
  p_level integer,
  p_distance_m integer,
  p_squirrels integer,
  p_treats integer,
  p_duration_ms integer,
  p_client_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  handle text;
  flagged boolean := false;
  expected integer := 1;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select profiles.handle into handle from public.profiles where user_id = uid;
  if handle is null then
    return jsonb_build_object('ok', false, 'error', 'no_handle');
  end if;
  if p_run_id is null
     or p_score is null or p_score < 0
     or p_level is null or p_level < 1
     or p_distance_m is null or p_distance_m < 0
     or p_squirrels is null or p_squirrels < 0
     or p_treats is null or p_treats < 0
     or p_duration_ms is null or p_duration_ms < 0
     or btrim(coalesce(p_client_version, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  if exists (select 1 from public.acorn_attack_scores where run_id = p_run_id) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  while expected < 400 and p_distance_m >= (expected * 260 + 20 * expected * (expected - 1)) loop
    expected := expected + 1;
  end loop;
  if p_duration_ms <= 0 and p_distance_m > 0 then
    flagged := true;
  end if;
  if p_distance_m > p_duration_ms / 1000.0 * 25 then
    flagged := true;
  end if;
  if p_level < expected or p_level > expected + 1 then
    flagged := true;
  end if;
  if p_score > p_distance_m * 500 + 80000 then
    flagged := true;
  end if;

  insert into public.acorn_attack_scores (
    player_id, run_id, score, level, distance_m, squirrels, treats, duration_ms, client_version, flagged
  ) values (
    uid, p_run_id, p_score, p_level, p_distance_m, p_squirrels, p_treats, p_duration_ms, left(btrim(p_client_version), 32), flagged
  );

  return jsonb_build_object('ok', true, 'flagged', flagged);
end;
$$;

create or replace function public.acorn_attack_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  guest boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true);
  rows jsonb;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;

  with allowed as (
    select uid as player_id
    union
    select case when f.user_a_id = uid then f.user_b_id else f.user_a_id end
    from public.friendships f
    where not guest
      and (f.user_a_id = uid or f.user_b_id = uid)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = uid and b.blocked_id = case when f.user_a_id = uid then f.user_b_id else f.user_a_id end)
           or (b.blocked_id = uid and b.blocker_id = case when f.user_a_id = uid then f.user_b_id else f.user_a_id end)
      )
  ),
  best as (
    select distinct on (scores.player_id)
      scores.player_id,
      scores.score,
      scores.created_at
    from public.acorn_attack_scores scores
    join allowed on allowed.player_id = scores.player_id
    where not scores.flagged
    order by scores.player_id, scores.score desc, scores.created_at asc
  ),
  ranked as (
    select
      row_number() over (order by best.score desc, best.created_at asc) as rank,
      coalesce(profiles.handle, '') as handle,
      best.score,
      best.player_id = uid as mine
    from best
    left join public.profiles on profiles.user_id = best.player_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', ranked.rank,
      'handle', ranked.handle,
      'score', ranked.score,
      'mine', ranked.mine
    ) order by ranked.rank
  ), '[]'::jsonb)
  into rows
  from ranked;

  return jsonb_build_object('ok', true, 'rows', rows);
end;
$$;

revoke all on function public.submit_acorn_attack_score(uuid, integer, integer, integer, integer, integer, integer, text) from public, anon;
revoke all on function public.acorn_attack_leaderboard() from public, anon;
grant execute on function public.submit_acorn_attack_score(uuid, integer, integer, integer, integer, integer, integer, text) to authenticated;
grant execute on function public.acorn_attack_leaderboard() to authenticated;
