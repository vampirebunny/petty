-- Obstacle Course obstacle-7: NPCs slower than obstacle-6, so a steady clean run (about 4 RUN taps a second) wins.
-- Deploy race_report from the same commit first, so the server can replay obstacle-7 races.

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
    new.config_version := 'obstacle-7';
  end if;
  return new;
end;
$$;

revoke all on function public.stadium_stamp_config_version() from public, anon, authenticated;

update public.races r
set config_version = 'obstacle-7'
from public.competition_events ev
where ev.id = r.event_id
  and ev.event_type = 'obstacle'
  and r.status in ('open', 'locked', 'countdown');
