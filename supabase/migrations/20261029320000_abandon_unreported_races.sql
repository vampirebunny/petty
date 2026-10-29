-- A Fun Run stays "running" until a phone reports. If that report never arrives, the
-- entry stays checked_in and every later card says the pet is already in a race.
-- The race brief marks a missing report DNF at max length (60s) plus 20s.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.stadium_finish_cooldown(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  race_event text;
  started timestamptz;
  until timestamptz;
begin
  select * into cfg from public.stadium_config where id = 1;
  select ev.event_type, r.started_at into race_event, started
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where r.id = p_race_id;
  -- A race that already ended long ago must not start a fresh rest when its
  -- results are written late. A race that just finished still rests from now.
  until := coalesce(started, now()) + make_interval(secs => cfg.cooldown_seconds);
  if until > now() then
    until := now() + make_interval(secs => cfg.cooldown_seconds);
  end if;
  insert into public.pet_race_state (pet_id, event_type, cooldown_until)
  select e.pet_id, race_event, until
  from public.race_entries e
  where e.race_id = p_race_id and not e.is_npc and e.status = 'finished' and e.pet_id is not null
  on conflict (pet_id, event_type) do update
  set cooldown_until = greatest(public.pet_race_state.cooldown_until, excluded.cooldown_until);
end;
$$;

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
  -- funrun-1 max length is 60s. The brief adds 20s for a missing report.
  dnf_after interval := interval '80 seconds';
begin
  select * into cfg from public.stadium_config where id = 1;
  select races.status, races.first_report_at, s.starts_at
  into race_status, first_at, starts
  from public.races
  join public.competition_events ev on ev.id = races.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where races.id = p_race_id;
  if race_status = 'finished' or race_status = 'cancelled' or starts is null then
    return;
  end if;
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
  dnf_after interval := interval '80 seconds';
begin
  select * into cfg from public.stadium_config where id = 1;
  perform public.stadium_merge_classes();

  for r in
    select races.id
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
    if r.event_type <> 'funRun' then
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
