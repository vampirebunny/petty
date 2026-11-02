-- Soft-end the active pet. A later push of a new pet must not stamp this one retired.
create or replace function public.push_active_pet(
  p_device_id text,
  p_id uuid,
  p_doc jsonb,
  p_doc_schema int,
  p_local_revision bigint,
  p_client_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.pets%rowtype;
  other public.pets%rowtype;
  gate text;
begin
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return gate;
  end if;
  if p_doc->>'ownerId' is distinct from uid::text then
    raise exception 'owner mismatch';
  end if;

  select * into existing from public.pets where id = p_id;
  if found and existing.owner_user_id <> uid then
    raise exception 'not owner';
  end if;
  if found and existing.status = 'retired' then
    raise exception 'retired';
  end if;
  if found and existing.status = 'restarted' then
    raise exception 'restarted';
  end if;
  if found and existing.local_revision > p_local_revision then
    return 'stale';
  end if;
  if found and existing.local_revision = p_local_revision then
    return 'ok';
  end if;

  if found then
    if existing.doc->>'name' is distinct from p_doc->>'name'
      and not public.pet_name_allowed(coalesce(p_doc->>'name', '')) then
      return 'name';
    end if;
  elsif not public.pet_name_allowed(coalesce(p_doc->>'name', '')) then
    return 'name';
  end if;

  select * into other from public.pets
    where owner_user_id = uid and status = 'active' and id <> p_id;
  if found and other.local_revision >= p_local_revision then
    return 'stale';
  end if;
  if found then
    update public.pets
      set status = 'restarted',
          restarted_at = coalesce(restarted_at, now()),
          doc = jsonb_set(coalesce(doc, '{}'::jsonb), '{equipped}', '{}'::jsonb, true)
      where id = other.id;
  end if;

  insert into public.pets (
    id, owner_user_id, status, doc, doc_schema, local_revision, client_updated_at
  ) values (
    p_id, uid, 'active', p_doc, p_doc_schema, p_local_revision, p_client_updated_at
  )
  on conflict (id) do update set
    status = 'active',
    doc = excluded.doc,
    doc_schema = excluded.doc_schema,
    local_revision = excluded.local_revision,
    client_updated_at = excluded.client_updated_at
  where public.pets.local_revision < excluded.local_revision;

  return 'ok';
end;
$$;

create or replace function public.restart_pet(
  p_device_id text,
  p_id uuid,
  p_doc jsonb,
  p_doc_schema int,
  p_local_revision bigint,
  p_client_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.pets%rowtype;
  gate text;
  doc jsonb;
  race_id uuid;
begin
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return gate;
  end if;
  if p_doc->>'ownerId' is distinct from uid::text then
    raise exception 'owner mismatch';
  end if;

  select * into existing from public.pets where id = p_id;
  if found and existing.owner_user_id <> uid then
    raise exception 'not owner';
  end if;
  if found and existing.status = 'retired' then
    return 'ok';
  end if;
  if found and existing.local_revision > p_local_revision then
    return 'stale';
  end if;
  if found and existing.status = 'restarted' and existing.local_revision = p_local_revision then
    return 'ok';
  end if;

  doc := jsonb_set(coalesce(p_doc, '{}'::jsonb), '{equipped}', '{}'::jsonb, true);

  insert into public.pets (
    id, owner_user_id, status, doc, doc_schema, local_revision, client_updated_at, restarted_at
  ) values (
    p_id, uid, 'restarted', doc, p_doc_schema, p_local_revision, p_client_updated_at, now()
  )
  on conflict (id) do update set
    status = 'restarted',
    doc = excluded.doc,
    doc_schema = excluded.doc_schema,
    local_revision = excluded.local_revision,
    client_updated_at = excluded.client_updated_at,
    restarted_at = coalesce(public.pets.restarted_at, now())
  where public.pets.local_revision < excluded.local_revision
    or public.pets.status = 'active';

  for race_id in
    select r.id
    from public.races r
    join public.competition_events ev on ev.id = r.event_id
    where r.host_player_id = uid
      and ev.cup = 'friends'
      and r.status in ('open', 'locked', 'countdown')
  loop
    perform public.friend_game_cancel(race_id);
  end loop;

  update public.race_entries e
    set status = 'withdrawn'
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where e.race_id = r.id
    and e.player_id = uid
    and e.pet_id = p_id
    and r.host_player_id is distinct from uid
    and ev.cup = 'friends'
    and e.status in ('signed_up', 'checked_in')
    and r.status in ('open', 'locked', 'countdown');

  update public.friend_game_invites i
    set status = 'declined', responded_at = now()
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where i.race_id = r.id
    and i.invitee_id = uid
    and r.host_player_id is distinct from uid
    and ev.cup = 'friends'
    and i.status in ('pending', 'accepted')
    and r.status in ('open', 'locked', 'countdown');

  update public.race_entries e
    set status = 'withdrawn'
  from public.races r
  join public.competition_events ev on ev.id = r.event_id
  where e.race_id = r.id
    and e.player_id = uid
    and e.pet_id = p_id
    and e.status in ('signed_up', 'checked_in')
    and r.status in ('open', 'locked', 'countdown')
    and ev.cup is distinct from 'friends';

  update public.runway_invites
    set status = 'withdrawn'
  where player_id = uid
    and submitted = false
    and status in ('invited', 'accepted');

  return 'ok';
end;
$$;

revoke all on function public.restart_pet(text, uuid, jsonb, int, bigint, timestamptz) from public, anon;
grant execute on function public.restart_pet(text, uuid, jsonb, int, bigint, timestamptz) to authenticated;
