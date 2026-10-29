-- A rest blocks only the races that start before it ends. Later slots of the same event stay open.
-- The owner applies this. Do not run it against the hosted project from an agent.

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
  from public.race_entries e join public.races r on r.id = e.race_id
  where e.pet_id = p_pet.id and e.status in ('signed_up', 'checked_in');
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
