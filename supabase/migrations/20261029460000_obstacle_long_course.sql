-- Obstacle Course obstacle-2: no sprints and a course about three times longer, so a race
-- can run up to 120 s. The server waits 140 s (the max plus 20 s for a missing report)
-- before it marks unreported Obstacle racers DNF. Other events keep 80 s.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.stadium_dnf_after(p_event_type text)
returns interval
language sql
immutable
as $$
  select case p_event_type
    when 'obstacle' then interval '140 seconds'
    else interval '80 seconds'
  end;
$$;

revoke all on function public.stadium_dnf_after(text) from public, anon, authenticated;

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
    new.config_version := 'dockdive-1';
  elsif kind = 'funRun' then
    new.config_version := 'funrun-2';
  elsif kind = 'obstacle' then
    new.config_version := 'obstacle-2';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

update public.races r
set config_version = 'obstacle-2'
from public.competition_events ev
where ev.id = r.event_id and ev.event_type = 'obstacle' and r.status in ('open', 'locked', 'countdown');

create or replace function public.stadium_maybe_finalize(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  live_total int;
  reported int;
  first_at timestamptz;
  starts timestamptz;
  race_status text;
  kind text;
  dnf_after interval;
begin
  select * into cfg from public.stadium_config where id = 1;
  select races.status, races.first_report_at, s.starts_at, ev.event_type
  into race_status, first_at, starts, kind
  from public.races
  join public.competition_events ev on ev.id = races.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where races.id = p_race_id;
  if race_status = 'finished' or race_status = 'cancelled' or starts is null then
    return;
  end if;
  dnf_after := public.stadium_dnf_after(kind);
  if starts + dnf_after <= now() then
    update public.race_entries
    set status = 'no_show'
    where race_id = p_race_id and race_entries.status = 'signed_up';
  end if;
  select count(*) into live_total from public.race_entries
  where race_id = p_race_id and not is_npc and race_entries.status in ('checked_in', 'finished');
  select count(*) into reported from public.race_entries
  where race_id = p_race_id and not is_npc and finish_ms is not null;
  if starts + dnf_after > now()
    and live_total > 1
    and reported < live_total
    and (first_at is null or first_at + make_interval(secs => cfg.report_wait_seconds) > now()) then
    return;
  end if;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and not is_npc and race_entries.status = 'checked_in' and finish_ms is null;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and is_npc and race_entries.status = 'checked_in';
  perform public.stadium_rank(p_race_id);
end;
$$;

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
    if r.event_type in ('funRun', 'hurdles', 'dockDive', 'obstacle') then
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
    if r.event_type not in ('funRun', 'hurdles', 'dockDive', 'obstacle') then
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
      and s.starts_at + public.stadium_dnf_after(ev.event_type) <= now()
    for update of races skip locked
  loop
    perform public.stadium_maybe_finalize(r.id);
  end loop;
end;
$$;
