-- Condition multiplier stamps. Deploy race_report from the same commit first, so the
-- server can replay funrun-3, meters800-2, hurdles-4, obstacle-8, and dockdive-2.
-- The owner applies this. Do not run it against the hosted project from an agent.

alter table public.races
  add column if not exists energy_per_meter numeric,
  add column if not exists hydration_per_meter numeric;

alter table public.race_entries
  add column if not exists condition_finish numeric;

alter table public.npc_calibration
  add column if not exists energy_per_meter numeric,
  add column if not exists hydration_per_meter numeric;

create or replace function public.stadium_stamp_config_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kind text;
begin
  select event_type into kind from public.competition_events where id = new.event_id;
  if kind = 'dockDive' then
    new.config_version := 'dockdive-2';
  elsif kind = 'funRun' then
    new.config_version := 'funrun-3';
  elsif kind = 'obstacle' then
    new.config_version := 'obstacle-8';
  elsif kind = 'meters800' then
    new.config_version := 'meters800-2';
  elsif kind = 'hurdles' then
    new.config_version := 'hurdles-4';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

-- Runs after races_stamp_config_version (name order). Copies the calibrated
-- per-meter rates once, when the race locks. A later job run leaves them.
create or replace function public.stadium_stamp_condition_rates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kind text;
begin
  if new.status = 'locked' and old.status is distinct from 'locked' and new.energy_per_meter is null then
    select event_type into kind from public.competition_events where id = new.event_id;
    select c.energy_per_meter, c.hydration_per_meter
      into new.energy_per_meter, new.hydration_per_meter
    from public.npc_calibration c
    where c.event = kind
      and c.class = new.class
      and c.config_version = new.config_version
      and c.energy_per_meter is not null
      and c.hydration_per_meter is not null
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_condition_rates() from public, anon, authenticated;

drop trigger if exists races_stamp_rates on public.races;
create trigger races_stamp_rates
  before update on public.races
  for each row execute function public.stadium_stamp_condition_rates();

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
    'energy_per_meter', r.energy_per_meter,
    'hydration_per_meter', r.hydration_per_meter,
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
        'detail', e.detail,
        'look', case when e.is_npc then null else p.doc->'look' end,
        'equipped', case when e.is_npc then null else p.doc->'equipped' end,
        'age_days', case when e.is_npc then null else p.doc->'ageDays' end
      ) order by e.lane)
      from public.race_entries e
      left join public.pets p on p.id = e.pet_id
      where e.race_id = r.id and e.status in ('signed_up', 'checked_in', 'finished')
    ), '[]'::jsonb),
    'awards', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.earned_at)
      from public.awards a
      where a.race_id = r.id and a.player_id = p_viewer_id
    ), '[]'::jsonb)
  ) into result
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  return result;
end;
$$;

revoke all on function public.race_state_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.race_state_for(uuid, uuid) to service_role;
