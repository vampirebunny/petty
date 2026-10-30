-- Obstacle Course obstacle-6: NPCs cruise near the RUN top speed and a missed obstacle costs about a second.
-- Deploy race_report from the same commit first, so the server can replay obstacle-6 races.

create or replace function public.stadium_stamp_config_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  kind text;
begin
  select event_type into kind from public.competition_events where id = new.event_id;
  if kind = 'dockDive' then
    new.config_version := 'dockdive-1';
  elsif kind = 'funRun' then
    new.config_version := 'funrun-2';
  elsif kind = 'obstacle' then
    new.config_version := 'obstacle-6';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

update public.races r
set config_version = 'obstacle-6'
from public.competition_events ev
where ev.id = r.event_id
  and ev.event_type = 'obstacle'
  and r.status in ('open', 'locked', 'countdown');
