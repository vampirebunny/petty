-- Submit-by choices are 15 min, 30 min, 1 hour, and 24 hours.
-- The floor sits below the shortest choice so send time and device clock drift
-- never reject a choice the host just tapped.

update public.runway_config
set min_deadline_minutes = 10
where id = 1;
