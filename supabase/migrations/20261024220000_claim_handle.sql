-- Phase C: save a handle once. Does not delete users or change an existing handle.

create or replace function public.claim_handle(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text := btrim(p_handle);
  availability text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where user_id = uid) then
    return 'saved';
  end if;

  availability := public.check_handle_available(cleaned);
  if availability <> 'available' then
    return availability;
  end if;

  begin
    insert into public.profiles (user_id, handle, handle_lower)
    values (uid, cleaned, lower(cleaned));
  exception
    when unique_violation then
      return 'taken';
  end;

  return 'saved';
end;
$$;

revoke all on function public.claim_handle(text) from public, anon;
grant execute on function public.claim_handle(text) to authenticated;
