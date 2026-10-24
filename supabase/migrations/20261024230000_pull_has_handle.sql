-- Phase D: pull reports a saved handle once profiles exist. Does not delete users.

create or replace function public.pull_account_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pet public.pets%rowtype;
  player public.player_state%rowtype;
  handle_saved boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into pet from public.pets where owner_user_id = uid and status = 'active' limit 1;
  select * into player from public.player_state where user_id = uid;
  select exists(
    select 1 from public.profiles where user_id = uid and handle is not null
  ) into handle_saved;
  return jsonb_build_object(
    'pet', pet.doc,
    'player', player.doc,
    'server_now', now(),
    'server_revision', greatest(coalesce(pet.local_revision, 0), coalesce(player.local_revision, 0)),
    'active_device_id', player.active_device_id,
    'active_device_label', player.active_device_label,
    'last_seen', player.last_seen,
    'has_handle', coalesce(handle_saved, false)
  );
end;
$$;

revoke all on function public.pull_account_state() from public, anon;
grant execute on function public.pull_account_state() to authenticated;
