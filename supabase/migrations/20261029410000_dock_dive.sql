-- Dock Dive: the first distance event. Races start like Fun Run and Hurdles, entries keep
-- their best distance and attempts, and results rank by distance instead of time.
-- The owner applies this. Do not run it against the hosted project from an agent.

alter table public.race_entries
  add column if not exists score_dm int,
  add column if not exists detail jsonb;

comment on column public.race_entries.score_dm is
  'Distance events: best distance in tenths of a meter. finish_ms then holds when that jump left the dock (ms from the start).';
comment on column public.race_entries.detail is
  'Distance events: { second_dm, best_attempt, attempts_m, flops }.';

-- sign_up stamps funrun-1 on every new race. Dock Dive races carry their own version.
create or replace function public.stadium_stamp_config_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select event_type from public.competition_events where id = new.event_id) = 'dockDive' then
    new.config_version := 'dockdive-1';
  end if;
  return new;
end;
$$;

drop trigger if exists races_stamp_config_version on public.races;
create trigger races_stamp_config_version
  before insert on public.races
  for each row execute function public.stadium_stamp_config_version();

update public.races r
set config_version = 'dockdive-1'
from public.competition_events ev
where ev.id = r.event_id and ev.event_type = 'dockDive' and r.status in ('open', 'locked', 'countdown');

create or replace function public.advance_races()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  r record;
  live int;
  dnf_after interval := interval '80 seconds';
begin
  select * into cfg from public.stadium_config where id = 1;
  perform public.stadium_merge_classes();

  for r in
    select races.id, ev.event_type
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'open'
      and s.starts_at - make_interval(secs => cfg.lock_seconds) <= now()
    for update of races skip locked
  loop
    update public.race_entries e
    set modifiers = public.stadium_modifier_snapshot(p.doc)
    from public.pets p
    where e.race_id = r.id and e.pet_id = p.id and e.status in ('signed_up', 'checked_in') and e.modifiers is null;
    update public.race_entries
    set status = case
      when last_seen_at is not null and last_seen_at >= now() - make_interval(secs => cfg.presence_grace_seconds)
        then 'checked_in'
      else 'no_show'
    end
    where race_id = r.id and status in ('signed_up', 'checked_in');
    update public.races set status = 'locked' where id = r.id;
    if r.event_type in ('funRun', 'hurdles', 'dockDive') then
      select count(*) into live
      from public.race_entries
      where race_id = r.id and status = 'checked_in' and not is_npc;
      if live = 1 then
        perform public.stadium_fill_npcs(r.id);
      end if;
    end if;
  end loop;

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'locked'
      and s.starts_at - make_interval(secs => cfg.countdown_seconds) <= now()
      and s.starts_at > now()
    for update of races skip locked
  loop
    update public.races set status = 'countdown' where id = r.id;
  end loop;

  for r in
    select races.id, ev.event_type, s.starts_at
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status in ('locked', 'countdown') and s.starts_at <= now()
    for update of races skip locked
  loop
    select count(*) into live
    from public.race_entries
    where race_id = r.id and status = 'checked_in' and not is_npc;
    if live = 0 then
      update public.races set status = 'cancelled', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if r.event_type not in ('funRun', 'hurdles', 'dockDive') then
      update public.race_entries set status = 'finished' where race_id = r.id and status = 'checked_in';
      update public.races set status = 'finished', started_at = r.starts_at where id = r.id;
      perform public.stadium_finish_cooldown(r.id);
      continue;
    end if;
    if live = 1 then
      perform public.stadium_fill_npcs(r.id);
    end if;
    update public.races
    set status = 'running', started_at = r.starts_at
    where id = r.id;
  end loop;

  for r in
    select races.id
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status = 'running'
      and s.starts_at + dnf_after <= now()
    for update of races skip locked
  loop
    perform public.stadium_maybe_finalize(r.id);
  end loop;
end;
$$;

-- Races rank by finish time. Dock Dive ranks by best distance, then second-best, then who
-- reached the best first (finish_ms holds that moment).
create or replace function public.stadium_rank(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  select ev.event_type into kind
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where r.id = p_race_id;
  if kind = 'dockDive' then
    with ranked as (
      select e.id, row_number() over (
        order by e.score_dm desc nulls last,
          (e.detail->>'second_dm')::int desc nulls last,
          e.finish_ms asc nulls last,
          e.signed_up_at
      ) as place
      from public.race_entries e
      where e.race_id = p_race_id and e.status = 'finished'
    )
    update public.race_entries e
    set place = ranked.place
    from ranked
    where e.id = ranked.id;
  else
    with ranked as (
      select e.id, row_number() over (order by e.finish_ms asc nulls last, e.signed_up_at) as place
      from public.race_entries e
      where e.race_id = p_race_id and e.status = 'finished'
    )
    update public.race_entries e
    set place = ranked.place
    from ranked
    where e.id = ranked.id;
  end if;
  update public.races set status = 'finished' where id = p_race_id;
  perform public.stadium_finish_cooldown(p_race_id);
end;
$$;

-- Distance values a phone may report: 0 to 12 m, in tenths.
create or replace function public.stadium_clean_detail(p_detail jsonb)
returns jsonb
language sql
immutable
as $$
  select case when jsonb_typeof(p_detail) = 'object' then jsonb_build_object(
    'second_dm', greatest(0, least(120, coalesce((p_detail->>'second_dm')::int, 0))),
    'best_attempt', greatest(0, least(2, coalesce((p_detail->>'best_attempt')::int, 0))),
    'attempts_m', coalesce(p_detail->'attempts_m', '[]'::jsonb),
    'flops', coalesce(p_detail->'flops', '[]'::jsonb)
  ) else null end;
$$;

drop function if exists public.submit_race_report(uuid, int, jsonb);

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
declare
  entry_id uuid;
  npc jsonb;
begin
  perform public.advance_races();
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if (select status from public.races where id = p_race_id) = 'finished' then
    return public.race_state(p_race_id);
  end if;
  select id into entry_id from public.race_entries
  where race_id = p_race_id and player_id = auth.uid() and not is_npc and status = 'checked_in' and finish_ms is null;
  if entry_id is null then
    return public.race_state(p_race_id);
  end if;
  if p_finish_ms is null then
    update public.race_entries set status = 'finished', finish_ms = null where id = entry_id;
  else
    update public.race_entries
    set finish_ms = greatest(0, p_finish_ms),
      score_dm = case when p_score_dm is null then null else greatest(0, least(120, p_score_dm)) end,
      detail = public.stadium_clean_detail(p_detail),
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
  return public.race_state(p_race_id);
end;
$$;

create or replace function public.race_state(p_race_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.advance_races();
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.race_entries
    where race_id = p_race_id and player_id = auth.uid()
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
        'mine', e.player_id = auth.uid(),
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

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;
revoke all on function public.stadium_rank(uuid) from public, anon, authenticated;
revoke all on function public.stadium_clean_detail(jsonb) from public, anon, authenticated;
revoke all on function public.submit_race_report(uuid, int, jsonb, int, jsonb) from public, anon;
grant execute on function public.submit_race_report(uuid, int, jsonb, int, jsonb) to authenticated;
