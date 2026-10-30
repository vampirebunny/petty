-- Obstacle Course: races start like Fun Run and Hurdles and carry the obstacle-1 rules.
-- The owner applies this. Do not run it against the hosted project from an agent.
--
-- Testing: an Obstacle Course card in every open slot (next to Hurdles), with no
-- Jump the Hurdle or Through the Tunnel requirement. Before launch, restore
-- stadium_required_tricks('obstacle') to array['hurdle', 'tunnel'] and use the launch
-- schedule from 20261029430000_schedule_ship_roster.sql (rotate Hurdles and Obstacle).

create or replace function public.stadium_required_tricks(p_event text)
returns text[]
language sql
immutable
as $$
  select case p_event
    when 'trickShow' then array['sit', 'speak', 'spin', 'stand_tall']
    when 'hurdles' then array[]::text[]
    when 'weave' then array['weave']
    when 'obstacle' then array[]::text[]
    else array[]::text[]
  end;
$$;

revoke all on function public.stadium_required_tricks(text) from public, anon, authenticated;

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
    new.config_version := 'obstacle-1';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

update public.races r
set config_version = 'obstacle-1'
from public.competition_events ev
where ev.id = r.event_id and ev.event_type = 'obstacle' and r.status in ('open', 'locked', 'countdown');

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
      and s.starts_at + dnf_after <= now()
    for update of races skip locked
  loop
    perform public.stadium_maybe_finalize(r.id);
  end loop;
end;
$$;

create or replace function public.ensure_slots()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  first_id bigint;
  slot bigint;
  veteran_event text;
begin
  select * into cfg from public.stadium_config where id = 1;
  first_id := floor(extract(epoch from now()) / cfg.slot_seconds)::bigint + 1;
  for slot in first_id .. first_id + cfg.slots_shown loop
    insert into public.competition_slots (id, starts_at)
    values (slot, to_timestamp(slot * cfg.slot_seconds))
    on conflict (id) do nothing;

    insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort) values
      (slot, 'funRun', 'both', public.stadium_required_tricks('funRun'), 'open', 0),
      (slot, 'dockDive', 'both', public.stadium_required_tricks('dockDive'), 'open', 1),
      (slot, 'hurdles', 'both', public.stadium_required_tricks('hurdles'), 'open', 2),
      (slot, 'obstacle', 'both', public.stadium_required_tricks('obstacle'), 'open', 3)
    on conflict (slot_id, event_type, cup) do nothing;

    if slot % 3 = 0 then
      veteran_event := (array['funRun', 'dockDive', 'hurdles', 'obstacle'])[1 + ((slot / 3) % 4)];
      insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
      values (slot, veteran_event, 'both', public.stadium_required_tricks(veteran_event), 'veteran', 4)
      on conflict (slot_id, event_type, cup) do nothing;
    end if;
  end loop;
end;
$$;

-- Upcoming slots already built get an open Obstacle Course card, and any Obstacle card
-- already on the board drops its trick requirement.
insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
select s.id, 'obstacle', 'both', array[]::text[], 'open', 3
from public.competition_slots s
where s.starts_at > now()
  and not exists (
    select 1 from public.competition_events e
    where e.slot_id = s.id and e.event_type = 'obstacle' and e.cup = 'open'
  );

update public.competition_events e
set required_tricks = array[]::text[]
from public.competition_slots s
where e.slot_id = s.id
  and e.event_type = 'obstacle'
  and s.starts_at > now();

select public.ensure_slots();
