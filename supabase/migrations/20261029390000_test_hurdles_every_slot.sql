-- Testing: a Hurdles race in every 1-minute slot, with no Jump the Hurdle requirement.
-- The owner applies this. Do not run it against the hosted project from an agent.
-- Restore stadium_required_tricks('hurdles') to array['hurdle'] and the rotating third
-- event in ensure_slots before launch.

create or replace function public.stadium_required_tricks(p_event text)
returns text[]
language sql
immutable
as $$
  select case p_event
    when 'trickShow' then array['sit', 'speak', 'spin', 'stand_tall']
    when 'hurdles' then array[]::text[]
    when 'weave' then array['weave']
    when 'obstacle' then array['hurdle', 'tunnel']
    else array[]::text[]
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
  open_one text;
  veteran_event text;
begin
  select * into cfg from public.stadium_config where id = 1;
  first_id := floor(extract(epoch from now()) / cfg.slot_seconds)::bigint + 1;
  for slot in first_id .. first_id + cfg.slots_shown loop
    insert into public.competition_slots (id, starts_at)
    values (slot, to_timestamp(slot * cfg.slot_seconds))
    on conflict (id) do nothing;

    open_one := case when slot % 2 = 0 then 'dockDive' else 'sniffOut' end;

    insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort) values
      (slot, 'funRun', 'both', public.stadium_required_tricks('funRun'), 'open', 0),
      (slot, open_one, 'both', public.stadium_required_tricks(open_one), 'open', 1),
      (slot, 'hurdles', 'both', public.stadium_required_tricks('hurdles'), 'open', 2)
    on conflict (slot_id, event_type, cup) do nothing;

    if slot % 3 = 0 then
      veteran_event := (array['funRun', 'dockDive', 'sniffOut', 'funRun', 'hurdles'])[1 + ((slot / 3) % 5)];
      insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
      values (slot, veteran_event, 'both', public.stadium_required_tricks(veteran_event), 'veteran', 3)
      on conflict (slot_id, event_type, cup) do nothing;
    end if;
  end loop;
end;
$$;

-- Slots already built keep their old third event. Add Hurdles where it is missing,
-- and drop the trick requirement on Hurdles that are already on the board.
insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
select s.id, 'hurdles', 'both', array[]::text[], 'open', 2
from public.competition_slots s
where s.starts_at > now()
  and not exists (
    select 1 from public.competition_events e
    where e.slot_id = s.id and e.event_type = 'hurdles' and e.cup = 'open'
  );

update public.competition_events e
set required_tricks = array[]::text[]
from public.competition_slots s
where e.slot_id = s.id
  and e.event_type = 'hurdles'
  and s.starts_at > now();

select public.ensure_slots();
