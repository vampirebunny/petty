-- 800 Meters: the Fun Run field on a track 13 times as long (910 m). Every level races
-- in one Open field, and every slot offers it alongside Fun Run, Dock Dive, and
-- Hurdles or Obstacle Course. The time limit is 780 s. The server waits 800 s
-- (that limit plus 20 s for a missing report) before it marks an unreported
-- racer DNF. Deploy race_report from the same commit first, so the server can
-- replay meters800-1.
-- The owner applies this. Do not run it against the hosted project from an agent.

alter table public.competition_events drop constraint if exists competition_events_event_type_check;
alter table public.competition_events
  add constraint competition_events_event_type_check
    check (event_type in ('funRun', 'dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle', 'meters800'));

create or replace function public.stadium_event_class(p_event_type text, p_cup text, p_level int)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_cup = 'veteran' then 'veteran'
    when p_event_type in ('funRun', 'meters800') then 'open'
    else public.stadium_class(p_level)
  end;
$$;

revoke all on function public.stadium_event_class(text, text, int) from public, anon;

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
    new.config_version := 'obstacle-7';
  elsif kind = 'meters800' then
    new.config_version := 'meters800-1';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

create or replace function public.stadium_dnf_after(p_event_type text)
returns interval
language sql
immutable
as $$
  select case p_event_type
    when 'obstacle' then interval '140 seconds'
    when 'meters800' then interval '800 seconds'
    else interval '80 seconds'
  end;
$$;

revoke all on function public.stadium_dnf_after(text) from public, anon, authenticated;

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
  third text;
  veteran_event text;
begin
  select * into cfg from public.stadium_config where id = 1;
  first_id := floor(extract(epoch from now()) / cfg.slot_seconds)::bigint + 1;
  for slot in first_id .. first_id + cfg.slots_shown loop
    insert into public.competition_slots (id, starts_at)
    values (slot, to_timestamp(slot * cfg.slot_seconds))
    on conflict (id) do nothing;

    third := case when slot % 2 = 0 then 'hurdles' else 'obstacle' end;

    insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort) values
      (slot, 'funRun', 'both', public.stadium_required_tricks('funRun'), 'open', 0),
      (slot, 'dockDive', 'both', public.stadium_required_tricks('dockDive'), 'open', 1),
      (slot, third, 'both', public.stadium_required_tricks(third), 'open', 2),
      (slot, 'meters800', 'both', public.stadium_required_tricks('meters800'), 'open', 3)
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

-- Veteran cards already sitting on future slots keep sort 3, which would tie with 800 Meters.
update public.competition_events ev
set sort = 4
from public.competition_slots s
where ev.slot_id = s.id
  and ev.cup = 'veteran'
  and s.starts_at > now();

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
  host_in boolean;
begin
  select * into cfg from public.stadium_config where id = 1;
  perform public.stadium_merge_classes();

  for r in
    select races.id, ev.event_type, ev.cup, races.host_player_id
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
    if r.cup = 'friends' then
      update public.friend_game_invites set status = 'withdrawn', responded_at = now()
      where race_id = r.id and status = 'pending';
      select count(*) into live
      from public.race_entries
      where race_id = r.id and status = 'checked_in' and not is_npc;
      host_in := exists (
        select 1 from public.race_entries
        where race_id = r.id and status = 'checked_in' and player_id = r.host_player_id
      );
      if not host_in or live < 2 then
        perform public.friend_game_cancel(r.id);
      end if;
      continue;
    end if;
    if r.event_type in ('funRun', 'hurdles', 'dockDive', 'obstacle', 'meters800') then
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
    select races.id, ev.event_type, ev.cup, races.host_player_id, s.starts_at
    from public.races
    join public.competition_events ev on ev.id = races.event_id
    join public.competition_slots s on s.id = ev.slot_id
    where races.status in ('locked', 'countdown') and s.starts_at <= now()
    for update of races skip locked
  loop
    select count(*) into live
    from public.race_entries
    where race_id = r.id and status = 'checked_in' and not is_npc;
    if r.cup = 'friends' then
      host_in := exists (
        select 1 from public.race_entries
        where race_id = r.id and status = 'checked_in' and player_id = r.host_player_id
      );
      if not host_in or live < 2 then
        perform public.friend_game_cancel(r.id);
        update public.races set started_at = r.starts_at where id = r.id;
        continue;
      end if;
      update public.races set status = 'running', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if live = 0 then
      update public.races set status = 'cancelled', started_at = r.starts_at where id = r.id;
      continue;
    end if;
    if r.event_type not in ('funRun', 'hurdles', 'dockDive', 'obstacle', 'meters800') then
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

  perform public.stadium_release_closed_entries();
end;
$$;

select public.ensure_slots();
