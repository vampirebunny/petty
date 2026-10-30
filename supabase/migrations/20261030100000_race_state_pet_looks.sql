-- Live races draw other players' pets in their real coat, age, and outfit.
-- Human entries now carry look, equipped, and age_days from the server copy of the pet.

create or replace function public.race_state_for(p_race_id uuid, p_viewer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.advance_races();
  if p_viewer_id is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.race_entries
    where race_id = p_race_id and player_id = p_viewer_id
  ) then
    raise exception 'not in race';
  end if;
  select jsonb_build_object(
    'server_now', now(),
    'race_id', r.id,
    'status', r.status,
    'class', r.class,
    'event_type', ev.event_type,
    'cup', ev.cup,
    'starts_at', s.starts_at,
    'seed', r.seed,
    'config_version', r.config_version,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_id', e.id,
        'lane', e.lane,
        'pet_name', e.pet_name,
        'pet_level', e.pet_level,
        'species', e.species,
        'breed_id', e.breed_id,
        'handle', e.handle,
        'status', e.status,
        'mine', e.player_id = p_viewer_id,
        'is_npc', e.is_npc,
        'skill', e.skill,
        'coat', e.coat,
        'modifiers', e.modifiers,
        'finish_ms', e.finish_ms,
        'place', e.place,
        'score_dm', e.score_dm,
        'detail', e.detail,
        'look', case when e.is_npc then null else p.doc->'look' end,
        'equipped', case when e.is_npc then null else p.doc->'equipped' end,
        'age_days', case when e.is_npc then null else p.doc->'ageDays' end
      ) order by e.lane)
      from public.race_entries e
      left join public.pets p on p.id = e.pet_id
      where e.race_id = r.id and e.status in ('signed_up', 'checked_in', 'finished')
    ), '[]'::jsonb)
  ) into result
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  join public.competition_slots s on s.id = ev.slot_id
  where r.id = p_race_id;
  return result;
end;
$$;

revoke all on function public.race_state_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.race_state_for(uuid, uuid) to service_role;
