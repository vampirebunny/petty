-- Fun Run rest is 6 minutes. Each card reports when that event can be entered again.
-- The owner applies this. Do not run it against the hosted project from an agent.

update public.stadium_config set cooldown_seconds = 360 where id = 1;

-- Rests already written used 15 minutes. Shift them back by the 9-minute difference.
update public.pet_race_state
set cooldown_until = cooldown_until - interval '9 minutes'
where cooldown_until > now();

create or replace function public.get_upcoming_slots(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  pet public.pets%rowtype;
  species text;
  pet_class text;
  entry_id uuid;
  my_race uuid;
  slots jsonb;
begin
  perform public.ensure_slots();
  perform public.advance_races();
  pet := public.stadium_owned_pet(p_pet_id);
  select * into cfg from public.stadium_config where id = 1;
  species := public.stadium_species(pet.doc);
  pet_class := public.stadium_class((pet.doc->>'level')::int);

  select e.id, e.race_id into entry_id, my_race from public.race_entries e
  where e.pet_id = pet.id and e.status in ('signed_up', 'checked_in');

  select coalesce(jsonb_agg(slot_row order by slot_row->>'starts_at'), '[]'::jsonb) into slots
  from (
    select jsonb_build_object(
      'id', s.id,
      'starts_at', s.starts_at,
      'events', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', ev.id,
          'event_type', ev.event_type,
          'species_allowed', ev.species_allowed,
          'cup', ev.cup,
          'required_trick', (
            select public.stadium_trick_id(species, trick)
            from unnest(ev.required_tricks) as trick
            where coalesce((pet.doc->'training'->public.stadium_trick_id(species, trick)->>'mastered')::boolean, false) = false
            limit 1
          ),
          'is_away', ev.is_away,
          'away_location', ev.away_location,
          'state', public.stadium_card_state(pet, ev.id),
          'rest_until', (
            select prs.cooldown_until from public.pet_race_state prs
            where prs.pet_id = pet.id
              and prs.event_type = ev.event_type
              and prs.cooldown_until > now()
          ),
          'signed_up', coalesce((
            select count(*) from public.race_entries e
            where e.race_id = coalesce(
              (select r.id from public.races r where r.id = my_race and r.event_id = ev.id),
              (
                select r.id from public.races r
                where r.event_id = ev.id
                  and r.class = case when ev.cup = 'veteran' then 'veteran' else pet_class end
                  and r.status = 'open'
                  and (select count(*) from public.race_entries x
                       where x.race_id = r.id and x.status in ('signed_up', 'checked_in')) < r.capacity
                order by r.created_at
                limit 1
              )
            )
            and e.status in ('signed_up', 'checked_in')
          ), 0)
        ) order by ev.sort), '[]'::jsonb)
        from public.competition_events ev
        where ev.slot_id = s.id
          and (ev.cup = 'open' or public.stadium_is_senior(pet.doc))
      )
    ) as slot_row
    from public.competition_slots s
    where s.starts_at > now()
    order by s.starts_at
    limit cfg.slots_shown
  ) shown;

  return jsonb_build_object(
    'server_now', now(),
    'config', jsonb_build_object(
      'slot_seconds', cfg.slot_seconds,
      'capacity', cfg.capacity,
      'gate_open_seconds', cfg.gate_open_seconds,
      'lock_seconds', cfg.lock_seconds,
      'cooldown_seconds', cfg.cooldown_seconds,
      'config_version', 'funrun-1'
    ),
    'class', pet_class,
    'species', species,
    'cooldown_until', null,
    'active_entry', case when entry_id is null then null else public.stadium_entry_json(entry_id) end,
    'slots', slots
  );
end;
$$;

