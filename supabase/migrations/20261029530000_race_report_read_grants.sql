-- race_report reads races and entries with the service role, then saves the finish.
-- Without select, that read fails, the finish is never stored, and the pet stays checked in.
-- The owner applies this. Do not run it against the hosted project from an agent.

grant select on public.races to service_role;
grant select on public.race_entries to service_role;
grant select on public.competition_events to service_role;
grant select on public.competition_slots to service_role;
