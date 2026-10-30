-- Launch schedule. The owner applies this. Do not run it against the hosted project from an agent.
--
-- Each 5-minute open slot is Fun Run, Dock Dive, and one of Hurdles or Obstacle Course.
-- Rest is 1 minute per event. Hurdles requires Jump the Hurdle. Obstacle Course requires
-- Jump the Hurdle and Through the Tunnel.
-- Future 1-minute slots are removed so their ids do not keep the old start times.

update public.stadium_config
set slot_seconds = 300, cooldown_seconds = 60
where id = 1;

create or replace function public.stadium_required_tricks(p_event text)
returns text[]
language sql
immutable
as $$
  select case p_event
    when 'trickShow' then array['sit', 'speak', 'spin', 'stand_tall']
    when 'hurdles' then array['hurdle']
    when 'weave' then array['weave']
    when 'obstacle' then array['hurdle', 'tunnel']
    else array[]::text[]
  end;
$$;

revoke all on function public.stadium_required_tricks(text) from public, anon, authenticated;

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
      (slot, third, 'both', public.stadium_required_tricks(third), 'open', 2)
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

-- 1-minute testing slots still in the future would keep showing beside the new board.
delete from public.competition_slots
where starts_at > now();

select public.ensure_slots();
