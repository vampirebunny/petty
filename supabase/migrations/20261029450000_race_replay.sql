-- Authoritative race results: the race_report Edge Function replays input logs and
-- writes finishes through apply_verified_race_report (service_role only).
-- Phones may no longer call submit_race_report with claimed times.

alter table public.race_entries
  add column if not exists input_log jsonb;

comment on column public.race_entries.input_log is
  'Player input log stored after a verified race_report replay. Null for NPCs.';

create table if not exists public.race_report_flags (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  entry_id uuid not null references public.race_entries (id) on delete cascade,
  kind text not null check (kind in ('mismatch', 'bot_like')),
  claimed_finish_ms int,
  replayed_finish_ms int,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists race_report_flags_race_id_idx on public.race_report_flags (race_id);

alter table public.race_report_flags enable row level security;

revoke all on table public.race_report_flags from public, anon, authenticated;
grant all on table public.race_report_flags to service_role;

-- Race JSON for a specific viewer (Edge Function has no auth.uid()).
create or replace function public.race_state_for(p_race_id uuid, p_viewer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.advance_races();
  if p_viewer_id is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.race_entries
    where race_id = p_race_id and player_id = p_viewer_id
  ) then
    raise exception 'not in race';
  end if;
  select jsonb_build_object(
    'server_now', now(),
    'race_id', r.id,
    'status', r.status,
    'class', r.class,
    'event_type', ev.event_type,
    'cup', ev.cup,
    'starts_at', s.starts_at,
    'seed', r.seed,
    'config_version', r.config_version,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_id', e.id,
        'lane', e.lane,
        'pet_name', e.pet_name,
        'pet_level', e.pet_level,
        'species', e.species,
        'breed_id', e.breed_id,
        'handle', e.handle,
        'status', e.status,
        'mine', e.player_id = p_viewer_id,
        'is_npc', e.is_npc,
        'skill', e.skill,
        'coat', e.coat,
        'modifiers', e.modifiers,
        'finish_ms', e.finish_ms,
        'place', e.place,
        'score_dm', e.score_dm,
        'detail', e.detail
      ) order by e.lane)
      from public.race_entries e
      where e.race_id = r.id and e.status in ('signed_up', 'checked_in', 'finished')
    ), '[]'::jsonb)
  ) into result
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  return result;
end;
$$;

create or replace function public.race_state(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.race_state_for(p_race_id, auth.uid());
end;
$$;

create or replace function public.apply_verified_race_report(
  p_race_id uuid,
  p_player_id uuid,
  p_finish_ms int,
  p_npc_finishes jsonb,
  p_score_dm int default null,
  p_detail jsonb default null,
  p_input_log jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
  npc jsonb;
begin
  perform public.advance_races();
  if p_player_id is null then
    raise exception 'not authenticated';
  end if;
  if (select status from public.races where id = p_race_id) = 'finished' then
    return public.race_state_for(p_race_id, p_player_id);
  end if;
  select id into entry_id from public.race_entries
  where race_id = p_race_id
    and player_id = p_player_id
    and not is_npc
    and status = 'checked_in'
    and finish_ms is null;
  if entry_id is null then
    return public.race_state_for(p_race_id, p_player_id);
  end if;
  if p_finish_ms is null then
    update public.race_entries
    set status = 'finished',
      finish_ms = null,
      input_log = p_input_log
    where id = entry_id;
  else
    update public.race_entries
    set finish_ms = greatest(0, p_finish_ms),
      score_dm = case when p_score_dm is null then null else greatest(0, least(120, p_score_dm)) end,
      detail = public.stadium_clean_detail(p_detail),
      input_log = p_input_log,
      status = 'finished'
    where id = entry_id;
  end if;
  update public.races set first_report_at = coalesce(first_report_at, now()) where id = p_race_id;
  if jsonb_typeof(p_npc_finishes) = 'array' then
    for npc in select value from jsonb_array_elements(p_npc_finishes) loop
      if npc->>'finish_ms' is null then
        update public.race_entries
        set status = 'finished'
        where id = (npc->>'entry_id')::uuid and race_id = p_race_id and is_npc and finish_ms is null;
      else
        update public.race_entries
        set finish_ms = greatest(0, (npc->>'finish_ms')::int),
          score_dm = case when npc->>'score_dm' is null then null else greatest(0, least(120, (npc->>'score_dm')::int)) end,
          detail = public.stadium_clean_detail(npc->'detail'),
          status = 'finished'
        where id = (npc->>'entry_id')::uuid and race_id = p_race_id and is_npc and finish_ms is null;
      end if;
    end loop;
  end if;
  perform public.stadium_maybe_finalize(p_race_id);
  return public.race_state_for(p_race_id, p_player_id);
end;
$$;

-- Block the old client-trust path.
create or replace function public.submit_race_report(
  p_race_id uuid,
  p_finish_ms int,
  p_npc_finishes jsonb,
  p_score_dm int default null,
  p_detail jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'use race_report';
end;
$$;

revoke all on function public.race_state_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.race_state_for(uuid, uuid) to service_role;

revoke all on function public.apply_verified_race_report(uuid, uuid, int, jsonb, int, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_verified_race_report(uuid, uuid, int, jsonb, int, jsonb, jsonb) to service_role;

revoke all on function public.submit_race_report(uuid, int, jsonb, int, jsonb) from public, anon, authenticated;
