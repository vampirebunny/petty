-- Solo Fun Runs get their NPCs when the line-up locks, so they stand on the track during
-- "Get ready! 3, 2, 1". The live count cannot change after the lock. The owner applies this.
-- Do not run it against the hosted project from an agent.

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
    if r.event_type = 'funRun' then
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
