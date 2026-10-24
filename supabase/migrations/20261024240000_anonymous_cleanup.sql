-- Phase H: empty anonymous users, and guests already queued for deletion.
-- Apply yourself. Creating this function does not delete anyone.
-- Enable pg_cron, then schedule: select public.cleanup_empty_anonymous_users();

create or replace function public.cleanup_empty_anonymous_users()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  guest_id uuid;
begin
  for guest_id in
    select u.id
    from auth.users u
    where exists (
        select 1 from public.pending_guest_deletes d where d.user_id = u.id
      )
      or (
        coalesce(u.is_anonymous, false)
        and u.created_at < now() - interval '30 days'
        and not exists (select 1 from public.pets p where p.owner_user_id = u.id)
        and not exists (select 1 from public.player_state s where s.user_id = u.id)
        and not exists (select 1 from public.ledger_entries l where l.user_id = u.id)
      )
  loop
    perform public.retire_limited_units(guest_id);
    delete from auth.users where id = guest_id;
    delete from public.pending_guest_deletes where user_id = guest_id;
  end loop;

  delete from public.pending_guest_deletes d
  where not exists (select 1 from auth.users u where u.id = d.user_id);
end;
$$;

revoke all on function public.cleanup_empty_anonymous_users() from public, anon, authenticated;
grant execute on function public.cleanup_empty_anonymous_users() to service_role;
