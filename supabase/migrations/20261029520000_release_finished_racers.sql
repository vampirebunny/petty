-- Finishing a race sometimes left the entry signed_up or checked_in. Every later card
-- then said the pet was already in a race. Rest is counted from the race start, and a
-- late result must not push that rest out to now.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.stadium_release_closed_entries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.race_entries e
  set status = 'finished'
  from public.races r
  where e.race_id = r.id
    and r.status = 'finished'
    and e.status in ('signed_up', 'checked_in');

  update public.race_entries e
  set status = 'no_show'
  from public.races r
  where e.race_id = r.id
    and r.status = 'cancelled'
    and e.status in ('signed_up', 'checked_in');
end;
$$;

revoke all on function public.stadium_release_closed_entries() from public, anon, authenticated;

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
  select ev.event_type, coalesce(r.started_at, s.starts_at)
  into race_event, started
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  if race_event is null or started is null then
    return;
  end if;
  -- Rest ends at the race start plus the configured rest. A result that arrives
  -- late must not start that rest over from the moment it is written.
  until := started + make_interval(secs => cfg.cooldown_seconds);
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
  if race_status = 'finished' or race_status = 'cancelled' then
    perform public.stadium_release_closed_entries();
    return;
  end if;
  if starts is null then
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
  set status = 'no_show'
  where race_id = p_race_id and race_entries.status = 'signed_up';
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and not is_npc and race_entries.status = 'checked_in';
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

  perform public.stadium_release_closed_entries();
end;
$$;

grant execute on function public.advance_races() to service_role;

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
  existing_ms int;
  npc jsonb;
  race_status text;
begin
  if p_player_id is null then
    raise exception 'not authenticated';
  end if;
  select status into race_status from public.races where id = p_race_id;

  -- Remember a row that is still blocking sign-up. advance_races may check it in,
  -- or close an already finished race, before the result is written.
  select e.id, e.finish_ms into entry_id, existing_ms
  from public.race_entries e
  where e.race_id = p_race_id
    and e.player_id = p_player_id
    and not e.is_npc
    and e.status in ('signed_up', 'checked_in');

  perform public.advance_races();

  if entry_id is null then
    select e.id, e.finish_ms into entry_id, existing_ms
    from public.race_entries e
    where e.race_id = p_race_id
      and e.player_id = p_player_id
      and not e.is_npc
      and e.status in ('signed_up', 'checked_in');
  end if;
  if entry_id is null then
    return public.race_state_for(p_race_id, p_player_id);
  end if;

  if existing_ms is null then
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
  else
    update public.race_entries
    set status = 'finished',
      input_log = coalesce(input_log, p_input_log)
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
  if race_status = 'finished' then
    perform public.stadium_rank(p_race_id);
  end if;
  perform public.stadium_maybe_finalize(p_race_id);
  return public.race_state_for(p_race_id, p_player_id);
end;
$$;
