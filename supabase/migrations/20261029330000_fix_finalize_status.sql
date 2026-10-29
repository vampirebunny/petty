-- stadium_maybe_finalize named a variable status, and Postgres then refused the
-- updates that also mention race_entries.status. The owner applies this.
-- Do not run it against the hosted project from an agent.

create or replace function public.stadium_maybe_finalize(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.stadium_config%rowtype;
  live_total int;
  reported int;
  first_at timestamptz;
  starts timestamptz;
  race_status text;
  -- funrun-1 max length is 60s. The brief adds 20s for a missing report.
  dnf_after interval := interval '80 seconds';
begin
  select * into cfg from public.stadium_config where id = 1;
  select races.status, races.first_report_at, s.starts_at
  into race_status, first_at, starts
  from public.races
  join public.competition_events ev on ev.id = races.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where races.id = p_race_id;
  if race_status = 'finished' or race_status = 'cancelled' or starts is null then
    return;
  end if;
  if starts + dnf_after <= now() then
    update public.race_entries
    set status = 'no_show'
    where race_id = p_race_id and race_entries.status = 'signed_up';
  end if;
  select count(*) into live_total from public.race_entries
  where race_id = p_race_id and not is_npc and race_entries.status in ('checked_in', 'finished');
  select count(*) into reported from public.race_entries
  where race_id = p_race_id and not is_npc and finish_ms is not null;
  if starts + dnf_after > now()
    and live_total > 1
    and reported < live_total
    and (first_at is null or first_at + make_interval(secs => cfg.report_wait_seconds) > now()) then
    return;
  end if;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and not is_npc and race_entries.status = 'checked_in' and finish_ms is null;
  update public.race_entries
  set status = 'finished'
  where race_id = p_race_id and is_npc and race_entries.status = 'checked_in';
  perform public.stadium_rank(p_race_id);
end;
$$;
