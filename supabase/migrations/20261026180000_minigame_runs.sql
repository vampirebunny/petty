-- Paddle Paws keeps every run. Apply this yourself; it does not delete users.
-- Cloud Hop can share this table later with game = 'cloud_hop'.

create table public.minigame_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('paddle_paws', 'cloud_hop')),
  score integer not null check (score >= 0),
  meters integer not null check (meters >= 0),
  pet_id uuid,
  client_run_id uuid not null,
  created_at timestamptz not null default now(),
  constraint minigame_runs_score_sane check (score <= meters * 3 + 50),
  constraint minigame_runs_client_once unique (player_id, client_run_id)
);

create index minigame_runs_rank_idx on public.minigame_runs (game, player_id, score desc);

alter table public.minigame_runs enable row level security;

revoke all on public.minigame_runs from public, anon, authenticated;
grant insert, select on public.minigame_runs to authenticated;

create policy minigame_runs_insert on public.minigame_runs
  for insert to authenticated
  with check (player_id = auth.uid());

create policy minigame_runs_select on public.minigame_runs
  for select to authenticated
  using (
    player_id = auth.uid()
    or (
      not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true)
      and exists (
        select 1 from public.friendships f
        where (f.user_a_id = auth.uid() and f.user_b_id = player_id)
           or (f.user_b_id = auth.uid() and f.user_a_id = player_id)
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = player_id)
           or (b.blocked_id = auth.uid() and b.blocker_id = player_id)
      )
    )
  );

create or replace function public.minigame_leaderboard(p_game text)
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
  if p_game is null or p_game not in ('paddle_paws', 'cloud_hop') then
    return jsonb_build_object('ok', false, 'error', 'bad_game');
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
    select distinct on (runs.player_id)
      runs.player_id,
      runs.score,
      runs.meters,
      runs.created_at
    from public.minigame_runs runs
    join allowed on allowed.player_id = runs.player_id
    where runs.game = p_game
    order by runs.player_id, runs.score desc, runs.created_at asc
  ),
  ranked as (
    select
      row_number() over (order by best.score desc, best.created_at asc) as rank,
      coalesce(profiles.handle, '') as handle,
      best.score,
      best.meters,
      best.created_at,
      best.player_id = uid as mine
    from best
    left join public.profiles on profiles.user_id = best.player_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', ranked.rank,
      'handle', ranked.handle,
      'score', ranked.score,
      'meters', ranked.meters,
      'at', ranked.created_at,
      'mine', ranked.mine
    ) order by ranked.rank
  ), '[]'::jsonb)
  into rows
  from ranked;

  return jsonb_build_object('ok', true, 'rows', rows);
end;
$$;

revoke all on function public.minigame_leaderboard(text) from public, anon;
grant execute on function public.minigame_leaderboard(text) to authenticated;
