-- Finishing a race left the entry signed_up or checked_in whenever the result
-- report never landed. Every later card then said the pet was already in a race,
-- until the DNF deadline (800s for 800 Meters). Leaving the race frees that entry.
-- A report that arrives afterward can still write the time onto the finished row.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.release_my_race_entry(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_race_id is null then
    return;
  end if;
  update public.race_entries e
  set status = 'finished'
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.race_id = r.id
    and e.race_id = p_race_id
    and e.player_id = auth.uid()
    and not e.is_npc
    and e.status in ('signed_up', 'checked_in')
    and (r.status in ('running', 'finished', 'cancelled') or s.starts_at <= now());
end;
$$;

revoke all on function public.release_my_race_entry(uuid) from public, anon;
grant execute on function public.release_my_race_entry(uuid) to authenticated;

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

  -- The DNF deadline passed and the race row is still running. The entry has
  -- to leave signed_up/checked_in or the one-active-entry index blocks the next race.
  update public.race_entries e
  set status = 'finished'
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where e.race_id = r.id
    and r.status = 'running'
    and e.status in ('signed_up', 'checked_in')
    and s.starts_at + public.stadium_dnf_after(ev.event_type) <= now();
end;
$$;

revoke all on function public.stadium_release_closed_entries() from public, anon, authenticated;

-- A race that already closed, or whose DNF deadline has passed, must not keep
-- the pet busy if the entry row was never updated.
create or replace function public.stadium_card_state(p_pet public.pets, p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  ev public.competition_events%rowtype;
  starts timestamptz;
  species text := public.stadium_species(p_pet.doc);
  active_event uuid;
  trick text;
begin
  select * into cfg from public.stadium_config where id = 1;
  select * into ev from public.competition_events where id = p_event_id;
  select starts_at into starts from public.competition_slots where id = ev.slot_id;

  select r.event_id into active_event
  from public.race_entries e
  join public.races r on r.id = e.race_id
  join public.competition_events active_ev on active_ev.id = r.event_id
  join public.competition_slots active_slot on active_slot.id = active_ev.slot_id
  where e.pet_id = p_pet.id
    and e.status in ('signed_up', 'checked_in')
    and r.status in ('open', 'locked', 'countdown', 'running')
    and active_slot.starts_at + public.stadium_dnf_after(active_ev.event_type) > now();
  if active_event = p_event_id then
    return 'entered';
  end if;
  if starts - make_interval(secs => cfg.lock_seconds) <= now() then
    return 'closed';
  end if;
  if ev.cup = 'veteran' and not public.stadium_is_senior(p_pet.doc) then
    return 'closed';
  end if;
  if ev.species_allowed <> 'both' and ev.species_allowed <> species then
    return 'wrong_species';
  end if;
  foreach trick in array ev.required_tricks loop
    if coalesce((p_pet.doc->'training'->public.stadium_trick_id(species, trick)->>'mastered')::boolean, false) = false then
      return 'missing_trick';
    end if;
  end loop;
  if exists (
    select 1 from public.pet_race_state prs
    where prs.pet_id = p_pet.id and prs.event_type = ev.event_type and prs.cooldown_until > starts
  ) then
    return 'resting';
  end if;
  if active_event is not null then
    return 'busy';
  end if;
  return 'open';
end;
$$;

revoke all on function public.stadium_card_state(public.pets, uuid) from public, anon, authenticated;

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

  -- A phone may already have freed the entry. The result still belongs on that row.
  select e.id, e.finish_ms into entry_id, existing_ms
  from public.race_entries e
  where e.race_id = p_race_id
    and e.player_id = p_player_id
    and not e.is_npc
    and e.status in ('signed_up', 'checked_in', 'finished');

  perform public.advance_races();

  if entry_id is null then
    select e.id, e.finish_ms into entry_id, existing_ms
    from public.race_entries e
    where e.race_id = p_race_id
      and e.player_id = p_player_id
      and not e.is_npc
      and e.status in ('signed_up', 'checked_in', 'finished');
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
