-- Ship roster only: Fun Run, Dock Dive, Hurdles, Obstacle Course.
-- Sniff Out, Trick Show, and Weave are cancelled and are not scheduled.
-- Their event_type values stay in competition_events_event_type_check for old rows.
--
-- Testing: keeps Hurdles in every open slot and the waived Jump the Hurdle gate from
-- 20261029390000_test_hurdles_every_slot.sql. Fast slots / no rest stay from
-- 20261029370000_test_fast_slots.sql. Do not restore those here.
--
-- Launch (separate migration later): Fun Run + Dock Dive + rotate(hurdles, obstacle);
-- restore stadium_required_tricks('hurdles') to array['hurdle']; restore 5-minute slots
-- and 6-minute rest.

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
      (slot, 'hurdles', 'both', public.stadium_required_tricks('hurdles'), 'open', 2)
    on conflict (slot_id, event_type, cup) do nothing;

    if slot % 3 = 0 then
      veteran_event := (array['funRun', 'dockDive', 'hurdles', 'obstacle'])[1 + ((slot / 3) % 4)];
      insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
      values (slot, veteran_event, 'both', public.stadium_required_tricks(veteran_event), 'veteran', 3)
      on conflict (slot_id, event_type, cup) do nothing;
    end if;
  end loop;
end;
$$;

-- Drop cancelled events from upcoming slots (no race started yet).
delete from public.competition_events e
using public.competition_slots s
where e.slot_id = s.id
  and s.starts_at > now()
  and e.event_type in ('sniffOut', 'trickShow', 'weave')
  and not exists (
    select 1 from public.races r where r.event_id = e.id
  );

-- Slots that only had Sniff Out as the no-trick card need Dock Dive.
insert into public.competition_events (slot_id, event_type, species_allowed, required_tricks, cup, sort)
select s.id, 'dockDive', 'both', public.stadium_required_tricks('dockDive'), 'open', 1
from public.competition_slots s
where s.starts_at > now()
  and not exists (
    select 1 from public.competition_events e
    where e.slot_id = s.id and e.event_type = 'dockDive' and e.cup = 'open'
  );

select public.ensure_slots();
