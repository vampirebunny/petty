-- Friend graph. Clients call security-definer RPCs. Anonymous sessions are rejected.
-- Apply after 20261025180000_beds_bowls.sql.

create table public.friend_config (
  id int primary key,
  requests_per_day int not null,
  max_friends int not null,
  decline_cooldown_days int not null,
  request_expiry_days int not null,
  reports_per_day int not null,
  constraint friend_config_singleton check (id = 1)
);

insert into public.friend_config (
  id, requests_per_day, max_friends, decline_cooldown_days, request_expiry_days, reports_per_day
) values (1, 20, 100, 30, 30, 10);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'canceled', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  notified_at timestamptz,
  constraint friend_requests_not_self check (requester_id <> addressee_id)
);

create unique index friend_requests_one_pending
  on public.friend_requests (requester_id, addressee_id)
  where status = 'pending';

create index friend_requests_addressee_pending
  on public.friend_requests (addressee_id)
  where status = 'pending';

create index friend_requests_requester_created
  on public.friend_requests (requester_id, created_at desc);

create table public.friendships (
  user_a_id uuid not null references auth.users (id) on delete cascade,
  user_b_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint friendships_ordered check (user_a_id < user_b_id)
);

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  reported_id uuid references auth.users (id) on delete set null,
  reported_deleted boolean not null default false,
  target text not null check (target in ('handle', 'pet_name')),
  reason text not null check (reason in ('inappropriate_handle', 'inappropriate_pet_name', 'something_else')),
  handle_text text,
  pet_name_text text,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned'))
);

create table public.push_tokens (
  player_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (player_id, token)
);

create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  friend_requests boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.friend_config enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_settings enable row level security;

revoke all on public.friend_config, public.friend_requests, public.friendships, public.blocks,
  public.reports, public.push_tokens, public.notification_settings
  from public, anon, authenticated;

create or replace function public.linked_player()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    return null;
  end if;
  return auth.uid();
end;
$$;

create or replace function public.normalize_for_match(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(coalesce(p_text, '')), '013457!|@$', 'oieastiias'),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

create or replace function public.content_is_blocked(p_text text)
returns boolean
language plpgsql
immutable
as $$
declare
  compact text := public.normalize_for_match(p_text);
  token text;
  subs text[] := array[
    'fuck', 'fuk', 'fvck', 'fck', 'fock', 'shit', 'bitch', 'cunt', 'pussy', 'penis', 'vagina',
    'nigger', 'nigga', 'retard', 'faggot', 'whore', 'slut', 'rape', 'rapist', 'killme', 'killyou',
    'suicide', 'cocaine', 'heroin', 'hitler', 'pedo', 'paedo', 'onlyfans', 'boopboopstaff', 'boopstaff'
  ];
  bans text[] := array[
    'ass', 'sex', 'cum', 'tit', 'fag', 'dick', 'cock', 'boob', 'boobs', 'porn', 'xxx', 'nazi', 'meth',
    'mod', 'admin', 'staff', 'support', 'official', 'boopboop', 'mylisto'
  ];
begin
  if compact = '' then
    return false;
  end if;
  if exists (select 1 from unnest(subs) as word where compact like '%' || word || '%') then
    return true;
  end if;
  for token in
    select public.normalize_for_match(part)
    from regexp_split_to_table(lower(coalesce(p_text, '')), '[^[:alnum:]]+') as part
    where part <> ''
  loop
    if token = any (bans) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

create or replace function public.pet_name_allowed(p_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  cleaned text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if cleaned = '' or char_length(cleaned) > 16 then
    return false;
  end if;
  if cleaned ~ '[[:cntrl:]]' then
    return false;
  end if;
  if cleaned ~* 'https?://|www\.|@|([[:alnum:]_-]+\.(com|net|org|io|co|app|me|tv|gg|xyz))|t\.me/' then
    return false;
  end if;
  if cleaned !~ '^[[:alnum:] .''-]+$' then
    return false;
  end if;
  return not public.content_is_blocked(cleaned);
end;
$$;

create or replace function public.check_handle_available(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(p_handle);
  lowered text;
  normalized text;
begin
  if cleaned is null or cleaned !~ '^[a-zA-Z0-9]{3,20}$' then
    return 'invalid';
  end if;
  if public.content_is_blocked(cleaned) then
    return 'reserved';
  end if;
  lowered := lower(cleaned);
  normalized := public.normalize_handle(cleaned);
  if exists (
    select 1 from public.reserved_handles
    where handle_lower = lowered or handle_lower = normalized
  ) then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where handle_lower = lowered)
    or exists (
      select 1 from public.handle_holds
      where handle_lower = lowered and released_at > now()
    ) then
    return 'taken';
  end if;
  return 'available';
end;
$$;

create or replace function public.users_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
      or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

create or replace function public.friend_count(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.friendships
  where user_a_id = p_user or user_b_id = p_user;
$$;

create or replace function public.lock_friend_pair(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(least(p_a, p_b)::text || ':' || greatest(p_a, p_b)::text, 0)
  );
end;
$$;

create or replace function public.expire_friend_requests(p_user uuid, p_other uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  days int;
begin
  select request_expiry_days into days from public.friend_config where id = 1;
  update public.friend_requests
    set status = 'expired', responded_at = now()
    where status = 'pending'
      and created_at < now() - make_interval(days => days)
      and (
        requester_id = p_user or addressee_id = p_user
        or requester_id = p_other or addressee_id = p_other
      );
end;
$$;

create or replace function public.friend_pet_card(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pet public.pets%rowtype;
begin
  select * into pet from public.pets
    where owner_user_id = p_user_id and status = 'active'
    limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'petId', pet.id,
    'name', pet.doc->>'name',
    'breedId', pet.doc->>'breedId',
    'look', coalesce(pet.doc->'look', '{}'::jsonb),
    'equipped', coalesce(pet.doc->'equipped', '{}'::jsonb),
    'ageDays', coalesce((pet.doc->>'ageDays')::numeric, 0),
    'weight', coalesce((pet.doc->>'weight')::numeric, 0),
    'vitality', coalesce((pet.doc->>'vitality')::numeric, 0),
    'seed', coalesce((pet.doc#>>'{attributes,seed}')::numeric, 1),
    'originArchetype', coalesce(pet.doc#>>'{attributes,archetype}', 'charmer'),
    'attributes', coalesce(pet.doc#>'{attributes,current}', '{}'::jsonb),
    'potential', coalesce(pet.doc#>'{attributes,potential}', '{}'::jsonb)
  );
end;
$$;

create or replace function public.friend_on_cooldown(p_from uuid, p_to uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  days int;
begin
  select decline_cooldown_days into days from public.friend_config where id = 1;
  return exists (
    select 1 from public.friend_requests
    where requester_id = p_from
      and addressee_id = p_to
      and status in ('declined', 'expired')
      and responded_at > now() - make_interval(days => days)
  );
end;
$$;

create or replace function public.friend_try_accept(p_me uuid, p_them uuid, p_request uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int;
begin
  select max_friends into cap from public.friend_config where id = 1;
  if public.friend_count(p_me) >= cap then
    return 'own_full';
  end if;
  if public.friend_count(p_them) >= cap then
    return 'their_full';
  end if;
  insert into public.friendships (user_a_id, user_b_id)
  values (least(p_me, p_them), greatest(p_me, p_them))
  on conflict do nothing;
  update public.friend_requests
    set status = 'canceled', responded_at = now()
    where status = 'pending'
      and id <> p_request
      and (
        (requester_id = p_me and addressee_id = p_them)
        or (requester_id = p_them and addressee_id = p_me)
      );
  update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = p_request and status = 'pending';
  return null;
end;
$$;

create or replace function public.lookup_handle(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cleaned text := btrim(coalesce(p_handle, ''));
  other uuid;
  handle_text text;
  request_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if left(cleaned, 1) = '@' then
    cleaned := btrim(substr(cleaned, 2));
  end if;
  select user_id, handle into other, handle_text
    from public.profiles
    where handle_lower = lower(cleaned);
  if other is null or other = uid or public.users_blocked(uid, other) then
    return jsonb_build_object('ok', true, 'found', false);
  end if;
  perform public.expire_friend_requests(uid, other);
  if exists (
    select 1 from public.friendships
    where user_a_id = least(uid, other) and user_b_id = greatest(uid, other)
  ) then
    return jsonb_build_object(
      'ok', true, 'found', true, 'state', 'friends',
      'userId', other, 'handle', handle_text, 'pet', public.friend_pet_card(other)
    );
  end if;
  select id into request_id from public.friend_requests
    where requester_id = uid and addressee_id = other and status = 'pending'
    limit 1;
  if request_id is not null then
    return jsonb_build_object(
      'ok', true, 'found', true, 'state', 'request_sent',
      'userId', other, 'handle', handle_text, 'pet', public.friend_pet_card(other),
      'requestId', request_id
    );
  end if;
  select id into request_id from public.friend_requests
    where requester_id = other and addressee_id = uid and status = 'pending'
    limit 1;
  if request_id is not null then
    return jsonb_build_object(
      'ok', true, 'found', true, 'state', 'request_received',
      'userId', other, 'handle', handle_text, 'pet', public.friend_pet_card(other),
      'requestId', request_id
    );
  end if;
  if public.friend_on_cooldown(uid, other) then
    return jsonb_build_object(
      'ok', true, 'found', true, 'state', 'cooldown',
      'userId', other, 'handle', handle_text, 'pet', public.friend_pet_card(other)
    );
  end if;
  return jsonb_build_object(
    'ok', true, 'found', true, 'state', 'none',
    'userId', other, 'handle', handle_text, 'pet', public.friend_pet_card(other)
  );
end;
$$;

create or replace function public.send_friend_request(p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cleaned text := btrim(coalesce(p_handle, ''));
  other uuid;
  mine text;
  incoming uuid;
  outgoing uuid;
  cap int;
  sent_limit int;
  sent_count int;
  accepted text;
  new_id uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select handle into mine from public.profiles where user_id = uid;
  if mine is null then
    return jsonb_build_object('ok', false, 'error', 'no_handle');
  end if;
  if left(cleaned, 1) = '@' then
    cleaned := btrim(substr(cleaned, 2));
  end if;
  select user_id into other from public.profiles where handle_lower = lower(cleaned);
  if other is null or other = uid or public.users_blocked(uid, other) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  perform public.lock_friend_pair(uid, other);
  perform public.expire_friend_requests(uid, other);
  if exists (
    select 1 from public.friendships
    where user_a_id = least(uid, other) and user_b_id = greatest(uid, other)
  ) then
    return jsonb_build_object('ok', true, 'state', 'friends');
  end if;
  select id into incoming from public.friend_requests
    where requester_id = other and addressee_id = uid and status = 'pending'
    limit 1;
  if incoming is not null then
    accepted := public.friend_try_accept(uid, other, incoming);
    if accepted is not null then
      return jsonb_build_object('ok', false, 'error', accepted);
    end if;
    return jsonb_build_object('ok', true, 'state', 'friends');
  end if;
  select id into outgoing from public.friend_requests
    where requester_id = uid and addressee_id = other and status = 'pending'
    limit 1;
  if outgoing is not null then
    return jsonb_build_object('ok', true, 'state', 'pending', 'requestId', outgoing);
  end if;
  if public.friend_on_cooldown(uid, other) then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  select requests_per_day, max_friends into sent_limit, cap from public.friend_config where id = 1;
  select count(*)::int into sent_count from public.friend_requests
    where requester_id = uid and created_at > now() - interval '24 hours';
  if sent_count >= sent_limit then
    return jsonb_build_object('ok', false, 'error', 'rate_limit');
  end if;
  if public.friend_count(uid) >= cap then
    return jsonb_build_object('ok', false, 'error', 'own_full');
  end if;
  if public.friend_count(other) >= cap then
    return jsonb_build_object('ok', false, 'error', 'their_full');
  end if;
  insert into public.friend_requests (requester_id, addressee_id, status)
  values (uid, other, 'pending')
  returning id into new_id;
  return jsonb_build_object('ok', true, 'state', 'pending', 'requestId', new_id);
end;
$$;

create or replace function public.respond_friend_request(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  row public.friend_requests%rowtype;
  accepted text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_action not in ('accept', 'decline') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into row from public.friend_requests where id = p_id and addressee_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  perform public.lock_friend_pair(uid, row.requester_id);
  perform public.expire_friend_requests(uid, row.requester_id);
  select * into row from public.friend_requests where id = p_id and addressee_id = uid and status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if public.users_blocked(uid, row.requester_id) then
    update public.friend_requests set status = 'canceled', responded_at = now() where id = row.id;
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_action = 'decline' then
    update public.friend_requests
      set status = 'declined', responded_at = now()
      where id = row.id and status = 'pending';
    return jsonb_build_object('ok', true);
  end if;
  accepted := public.friend_try_accept(uid, row.requester_id, row.id);
  if accepted is not null then
    return jsonb_build_object('ok', false, 'error', accepted);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_friend_request(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  update public.friend_requests
    set status = 'canceled', responded_at = now()
    where id = p_id and requester_id = uid and status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  delete from public.friendships
    where user_a_id = least(uid, p_user_id) and user_b_id = greatest(uid, p_user_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.block_player(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_user_id is null or p_user_id = uid then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  perform public.lock_friend_pair(uid, p_user_id);
  insert into public.blocks (blocker_id, blocked_id)
  values (uid, p_user_id)
  on conflict do nothing;
  delete from public.friendships
    where user_a_id = least(uid, p_user_id) and user_b_id = greatest(uid, p_user_id);
  update public.friend_requests
    set status = 'canceled', responded_at = now()
    where status = 'pending'
      and (
        (requester_id = uid and addressee_id = p_user_id)
        or (requester_id = p_user_id and addressee_id = uid)
      );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.unblock_player(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  delete from public.blocks where blocker_id = uid and blocked_id = p_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.report_player(p_user_id uuid, p_target text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  cap int;
  sent int;
  handle_text text;
  pet_name text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_user_id is null or p_user_id = uid then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_target not in ('handle', 'pet_name')
    or p_reason not in ('inappropriate_handle', 'inappropriate_pet_name', 'something_else') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select reports_per_day into cap from public.friend_config where id = 1;
  select count(*)::int into sent from public.reports
    where reporter_id = uid and created_at > now() - interval '24 hours';
  if sent >= cap then
    return jsonb_build_object('ok', false, 'error', 'rate_limit');
  end if;
  select handle into handle_text from public.profiles where user_id = p_user_id;
  select doc->>'name' into pet_name from public.pets
    where owner_user_id = p_user_id and status = 'active'
    limit 1;
  insert into public.reports (reporter_id, reported_id, target, reason, handle_text, pet_name_text)
  values (uid, p_user_id, p_target, p_reason, handle_text, pet_name);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_incoming_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  perform public.expire_friend_requests(uid, null);
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestId', request.id,
        'userId', request.requester_id,
        'handle', profile.handle,
        'createdAt', request.created_at,
        'pet', public.friend_pet_card(request.requester_id)
      ) order by request.created_at)
      from public.friend_requests request
      join public.profiles profile on profile.user_id = request.requester_id
      where request.addressee_id = uid and request.status = 'pending'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_sent_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  perform public.expire_friend_requests(uid, null);
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestId', request.id,
        'userId', request.addressee_id,
        'handle', profile.handle,
        'createdAt', request.created_at,
        'pet', public.friend_pet_card(request.addressee_id)
      ) order by request.created_at)
      from public.friend_requests request
      join public.profiles profile on profile.user_id = request.addressee_id
      where request.requester_id = uid and request.status = 'pending'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_friends()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', other_id,
        'handle', profile.handle,
        'pet', public.friend_pet_card(other_id)
      ) order by profile.handle)
      from (
        select case when user_a_id = uid then user_b_id else user_a_id end as other_id
        from public.friendships
        where user_a_id = uid or user_b_id = uid
      ) friends
      join public.profiles profile on profile.user_id = friends.other_id
      where not public.users_blocked(uid, friends.other_id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_blocked()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', block.blocked_id,
        'handle', profile.handle
      ) order by profile.handle)
      from public.blocks block
      join public.profiles profile on profile.user_id = block.blocked_id
      where block.blocker_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.register_push_token(p_token text, p_platform text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  if p_token is null or length(btrim(p_token)) < 8 or p_platform not in ('ios', 'android') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  insert into public.push_tokens (player_id, token, platform)
  values (uid, btrim(p_token), p_platform)
  on conflict (player_id, token) do update
    set platform = excluded.platform, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  delete from public.push_tokens where player_id = uid and token = btrim(coalesce(p_token, ''));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_friend_request_notifications(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  insert into public.notification_settings (user_id, friend_requests)
  values (uid, coalesce(p_enabled, true))
  on conflict (user_id) do update
    set friend_requests = excluded.friend_requests, updated_at = now();
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, true));
end;
$$;

create or replace function public.friend_request_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.linked_player();
  enabled boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'account_required');
  end if;
  select friend_requests into enabled from public.notification_settings where user_id = uid;
  return jsonb_build_object('ok', true, 'enabled', coalesce(enabled, true));
end;
$$;

create or replace function public.delete_friend_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  held text;
begin
  select handle_lower into held from public.profiles where user_id = p_user_id;
  if held is not null then
    insert into public.handle_holds (handle_lower, released_at)
    values (held, now() + interval '15 days')
    on conflict (handle_lower) do update
      set released_at = greatest(public.handle_holds.released_at, excluded.released_at);
  end if;
  delete from public.friend_requests
    where requester_id = p_user_id or addressee_id = p_user_id;
  delete from public.friendships
    where user_a_id = p_user_id or user_b_id = p_user_id;
  delete from public.blocks
    where blocker_id = p_user_id or blocked_id = p_user_id;
  delete from public.push_tokens where player_id = p_user_id;
  delete from public.notification_settings where user_id = p_user_id;
  delete from public.reports where reporter_id = p_user_id;
  update public.reports
    set reported_id = null, reported_deleted = true
    where reported_id = p_user_id;
end;
$$;

-- Keep a stored pet name that already failed the list. Reject only a new or changed name.
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
      set status = 'retired', retired_at = now()
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

revoke all on function public.linked_player() from public, anon, authenticated;
revoke all on function public.normalize_for_match(text) from public, anon, authenticated;
revoke all on function public.content_is_blocked(text) from public, anon, authenticated;
revoke all on function public.pet_name_allowed(text) from public, anon, authenticated;
revoke all on function public.users_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_count(uuid) from public, anon, authenticated;
revoke all on function public.lock_friend_pair(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expire_friend_requests(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_pet_card(uuid) from public, anon, authenticated;
revoke all on function public.friend_on_cooldown(uuid, uuid) from public, anon, authenticated;
revoke all on function public.friend_try_accept(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_friend_data(uuid) from public, anon, authenticated;

revoke all on function public.lookup_handle(text) from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, text) from public, anon;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.block_player(uuid) from public, anon;
revoke all on function public.unblock_player(uuid) from public, anon;
revoke all on function public.report_player(uuid, text, text) from public, anon;
revoke all on function public.list_incoming_requests() from public, anon;
revoke all on function public.list_sent_requests() from public, anon;
revoke all on function public.list_friends() from public, anon;
revoke all on function public.list_blocked() from public, anon;
revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
revoke all on function public.set_friend_request_notifications(boolean) from public, anon;
revoke all on function public.friend_request_notifications() from public, anon;

grant execute on function public.lookup_handle(text) to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_player(uuid) to authenticated;
grant execute on function public.unblock_player(uuid) to authenticated;
grant execute on function public.report_player(uuid, text, text) to authenticated;
grant execute on function public.list_incoming_requests() to authenticated;
grant execute on function public.list_sent_requests() to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_blocked() to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.set_friend_request_notifications(boolean) to authenticated;
grant execute on function public.friend_request_notifications() to authenticated;
grant execute on function public.delete_friend_data(uuid) to service_role;

grant select, update on public.friend_requests to service_role;
grant select, delete on public.push_tokens to service_role;
grant select on public.notification_settings to service_role;
grant select on public.blocks to service_role;
grant select on public.profiles to service_role;
