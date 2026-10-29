-- stadium_finish_cooldown named a variable event_type, which clashes with the
-- column of the same name once an abandoned race is written. The owner applies this.
-- Do not run it against the hosted project from an agent.

create or replace function public.stadium_finish_cooldown(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  race_event text;
  started timestamptz;
  until timestamptz;
begin
  select * into cfg from public.stadium_config where id = 1;
  select ev.event_type, r.started_at into race_event, started
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where r.id = p_race_id;
  -- A race that already ended long ago must not start a fresh rest when its
  -- results are written late. A race that just finished still rests from now.
  until := coalesce(started, now()) + make_interval(secs => cfg.cooldown_seconds);
  if until > now() then
    until := now() + make_interval(secs => cfg.cooldown_seconds);
  end if;
  insert into public.pet_race_state (pet_id, event_type, cooldown_until)
  select e.pet_id, race_event, until
  from public.race_entries e
  where e.race_id = p_race_id and not e.is_npc and e.status = 'finished' and e.pet_id is not null
  on conflict (pet_id, event_type) do update
  set cooldown_until = greatest(public.pet_race_state.cooldown_until, excluded.cooldown_until);
end;
$$;
