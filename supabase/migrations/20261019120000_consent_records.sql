-- DO NOT APPLY THIS MIGRATION FROM AN AGENT OR A SCRIPT IN THIS REPO.
-- Only the project owner applies migration files, with `supabase db push`
-- after the CLI is linked to project unfatkwtzfkqnnbgzuqs.
-- See supabase/README.md.

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('age_determined', 'age_status_changed', 'terms_accepted')),
  age_status text check (age_status in ('teen', 'adult', 'atLeast13')),
  age_source text check (age_source in ('apple', 'google', 'attestation')),
  terms_version text,
  privacy_version text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  platform text,
  app_version text,
  client_event_id uuid not null unique
);

comment on table public.consent_records is
  'Append-only consent events. Clients may insert and read their own rows. They cannot update or delete them.';

create index consent_records_user_id_idx on public.consent_records (user_id);

alter table public.consent_records enable row level security;

create policy consent_records_insert
  on public.consent_records
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy consent_records_select
  on public.consent_records
  for select
  to authenticated
  using (user_id = auth.uid());

grant select, insert on table public.consent_records to authenticated;

create or replace function public.delete_my_guest_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  anon boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select is_anonymous into anon from auth.users where id = uid;
  if anon is not true then
    raise exception 'not an anonymous user';
  end if;

  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_my_guest_data() is
  'Deletes the caller and their consent rows, and only when that caller is an anonymous user.';

revoke all on function public.delete_my_guest_data() from public;
revoke all on function public.delete_my_guest_data() from anon;
grant execute on function public.delete_my_guest_data() to authenticated;
