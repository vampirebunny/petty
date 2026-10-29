-- Testing: races every minute, no rest. The owner applies this. Do not run it against the
-- hosted project from an agent.

update public.stadium_config
set slot_seconds = 60, cooldown_seconds = 0
where id = 1;

-- Drop rests so testing is not blocked by older cooldown_until values.
update public.pet_race_state
set cooldown_until = now()
where cooldown_until > now();

-- Old 5-minute slots would still show and keep wrong start times on id collision.
-- Cascade clears their events and races; ensure_slots rebuilds the next minute slots.
delete from public.competition_slots
where starts_at > now();
