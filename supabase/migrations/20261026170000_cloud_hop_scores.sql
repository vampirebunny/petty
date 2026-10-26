-- Cloud Hop keeps one best score per account. Apply this yourself; it does not delete users.

create table public.cloud_hop_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  score integer not null check (score >= 0),
  meters integer not null check (meters >= 0),
  pet_name text not null,
  duration_s numeric not null check (duration_s >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cloud_hop_scores_rank_idx on public.cloud_hop_scores (score desc, updated_at asc);

create table public.cloud_hop_submit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index cloud_hop_submit_log_user_idx on public.cloud_hop_submit_log (user_id, created_at desc);

alter table public.cloud_hop_scores enable row level security;
alter table public.cloud_hop_submit_log enable row level security;

revoke all on public.cloud_hop_scores, public.cloud_hop_submit_log from public, anon, authenticated;

create or replace function public.submit_cloud_hop_score(
  p_score integer,
  p_meters integer,
  p_pet_name text,
  p_duration_s numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  handle text;
  collected integer;
  existing public.cloud_hop_scores%rowtype;
  recent integer;
  rank integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select profiles.handle into handle from public.profiles where user_id = uid;
  if handle is null then
    return jsonb_build_object('ok', false, 'error', 'no_handle');
  end if;
  if p_score is null or p_meters is null or p_duration_s is null or p_score < 0 or p_meters < 0 or p_duration_s < 0 then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;
  if btrim(coalesce(p_pet_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;
  collected := p_score - p_meters * 10;
  if collected < 0 or collected > p_meters * 40 + 2000 then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;
  if p_duration_s > 0 and p_meters / p_duration_s > 25 then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;
  if p_duration_s <= 0 and p_meters > 10 then
    return jsonb_build_object('ok', false, 'error', 'cheat');
  end if;

  select * into existing from public.cloud_hop_scores where user_id = uid;
  if found and existing.score >= p_score then
    select count(*)::int + 1 into rank
    from public.cloud_hop_scores s
    where s.user_id <> uid
      and (s.score > existing.score or (s.score = existing.score and s.updated_at < existing.updated_at));
    return jsonb_build_object('ok', true, 'updated', false, 'score', existing.score, 'rank', rank);
  end if;

  select count(*)::int into recent
  from public.cloud_hop_submit_log
  where user_id = uid and created_at > now() - interval '10 minutes';
  if recent >= 12 then
    return jsonb_build_object('ok', false, 'error', 'rate_limit');
  end if;

  insert into public.cloud_hop_submit_log (user_id) values (uid);
  insert into public.cloud_hop_scores (user_id, score, meters, pet_name, duration_s)
  values (uid, p_score, p_meters, left(btrim(p_pet_name), 24), p_duration_s)
  on conflict (user_id) do update set
    score = excluded.score,
    meters = excluded.meters,
    pet_name = excluded.pet_name,
    duration_s = excluded.duration_s,
    updated_at = now()
  where public.cloud_hop_scores.score < excluded.score;

  select count(*)::int + 1 into rank
  from public.cloud_hop_scores s
  where s.user_id <> uid
    and (s.score > p_score or (s.score = p_score and s.updated_at < now()));
  return jsonb_build_object('ok', true, 'updated', true, 'score', p_score, 'rank', rank);
end;
$$;

create or replace function public.cloud_hop_leaderboard()
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
      ranked.pet_name as "petName",
      ranked.score,
      ranked.user_id = uid as mine
    from (
      select
        scores.user_id,
        scores.score,
        scores.pet_name,
        profiles.handle,
        row_number() over (order by scores.score desc, scores.updated_at asc) as rank
      from public.cloud_hop_scores scores
      join public.profiles on profiles.user_id = scores.user_id
    ) ranked
    where ranked.rank <= 20
  ) board;

  select jsonb_build_object('rank', ranked.rank, 'score', ranked.score, 'petName', ranked.pet_name)
  into me
  from (
    select
      scores.user_id,
      scores.score,
      scores.pet_name,
      row_number() over (order by scores.score desc, scores.updated_at asc) as rank
    from public.cloud_hop_scores scores
  ) ranked
  where ranked.user_id = uid;

  return jsonb_build_object('ok', true, 'rows', rows, 'me', me);
end;
$$;

revoke all on function public.submit_cloud_hop_score(integer, integer, text, numeric) from public, anon;
revoke all on function public.cloud_hop_leaderboard() from public, anon;
grant execute on function public.submit_cloud_hop_score(integer, integer, text, numeric) to authenticated;
grant execute on function public.cloud_hop_leaderboard() to authenticated;
