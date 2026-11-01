-- Wire grant_race_awards into stadium_rank and return this viewer's
-- awards for the race from race_state_for. Snapshots now carry event
-- and class so ribbon badges survive a cache refresh.
-- The owner applies this. Do not run it against the hosted project from an agent.

create or replace function public.award_pet_snapshot(p_entry public.race_entries, p_pet public.pets)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'name', coalesce(p_entry.pet_name, p_pet.doc->>'name'),
    'species', coalesce(p_entry.species, p_pet.doc->>'species'),
    'breed', coalesce(p_entry.breed_id, p_pet.doc->>'breedId'),
    'coat', coalesce(p_pet.doc->'look'->>'coat', p_entry.coat->>'coat'),
    'seed', p_pet.doc->'attributes'->'seed'
  ) || coalesce((
    select jsonb_build_object(
      'event_type', ev.event_type,
      'class', case
        when ev.cup = 'veteran' then 'veteran'
        when ev.event_type in ('funRun', 'meters800') then 'none'
        else r.class
      end
    )
    from public.races r
    join public.competition_events ev on ev.id = r.event_id
    where r.id = p_entry.race_id
  ), '{}'::jsonb);
$$;

create or replace function public.stadium_rank(p_race_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  select ev.event_type into kind
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where r.id = p_race_id;
  if kind = 'dockDive' then
    with ranked as (
      select e.id, row_number() over (
        order by e.score_dm desc nulls last,
          (e.detail->>'second_dm')::int desc nulls last,
          e.finish_ms asc nulls last,
          e.signed_up_at
      ) as place
      from public.race_entries e
      where e.race_id = p_race_id and e.status = 'finished'
    )
    update public.race_entries e
    set place = ranked.place
    from ranked
    where e.id = ranked.id;
  else
    with ranked as (
      select e.id, row_number() over (order by e.finish_ms asc nulls last, e.signed_up_at) as place
      from public.race_entries e
      where e.race_id = p_race_id and e.status = 'finished'
    )
    update public.race_entries e
    set place = ranked.place
    from ranked
    where e.id = ranked.id;
  end if;
  update public.races set status = 'finished' where id = p_race_id;
  perform public.stadium_finish_cooldown(p_race_id);
  perform public.grant_race_awards(p_race_id);
end;
$$;

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
    ), '[]'::jsonb),
    'awards', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.earned_at)
      from public.awards a
      where a.race_id = r.id and a.player_id = p_viewer_id
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
revoke all on function public.stadium_rank(uuid) from public, anon, authenticated;
grant execute on function public.stadium_rank(uuid) to service_role;
revoke all on function public.grant_race_awards(uuid) from public, anon, authenticated;
grant execute on function public.grant_race_awards(uuid) to service_role;
