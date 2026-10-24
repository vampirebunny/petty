-- The earn lookup compared a PL/pgSQL variable named source to earn_rules.source.
-- Postgres treats that as an ambiguous column, so a batch with an earn aborts
-- instead of returning invalid. Rename the variable.

create or replace function public.append_ledger_entries(
  p_device_id text,
  p_entries jsonb,
  p_replay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gate text;
  entry jsonb;
  results jsonb := '[]'::jsonb;
  key text;
  kind text;
  entry_source text;
  lines jsonb;
  boops int;
  rule_max int;
  prefix text;
  status text;
  flags text[] := '{}';
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  gate := public.device_gate(p_device_id);
  if gate is not null then
    return to_jsonb(gate);
  end if;

  for entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    key := entry->>'idempotency_key';
    kind := entry->>'kind';
    entry_source := entry->>'source';
    lines := coalesce(entry->'lines', '[]'::jsonb);
    status := 'ok';
    flags := '{}';

    if exists(select 1 from public.ledger_entries where user_id = uid and idempotency_key = key) then
      results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', 'duplicate'));
      continue;
    end if;

    if kind is null or kind not in ('purchase', 'spend', 'earn', 'consume', 'reversal') or key is null then
      status := 'invalid';
    elsif p_replay and kind not in ('purchase', 'spend', 'reversal') then
      status := 'invalid';
    elsif kind = 'earn' then
      select key_prefix, max_amount into prefix, rule_max
        from public.earn_rules
        where earn_rules.source = entry_source and key like key_prefix || '%'
        order by length(key_prefix) desc
        limit 1;
      if prefix is null then
        status := 'invalid';
      elsif rule_max is not null then
        select coalesce(sum((line->>'qty')::int), 0) into boops
          from jsonb_array_elements(lines) line
          where line->>'asset' = 'boops';
        if boops > rule_max then
          status := 'invalid';
        end if;
      end if;
    elsif kind in ('purchase', 'spend') then
      select coalesce(sum((line->>'qty')::int), 0) into boops
        from jsonb_array_elements(lines) line
        where line->>'asset' = 'boops';
      if boops > 0 then
        status := 'invalid';
      elsif boops = 0 and exists (
        select 1 from jsonb_array_elements(lines) line
        where line->>'asset' in ('toy', 'furniture') and coalesce((line->>'qty')::int, 0) > 0
      ) then
        status := 'invalid';
      end if;
    end if;

    if status = 'ok' then
      insert into public.ledger_entries (
        user_id, idempotency_key, kind, source, lines, reverses_key, local_day, flags, device_id, device_time
      ) values (
        uid,
        key,
        kind,
        entry_source,
        lines,
        entry->>'reverses_key',
        entry->>'local_day',
        flags,
        p_device_id,
        nullif(entry->>'device_time', '')::timestamptz
      );
    end if;

    results := results || jsonb_build_array(jsonb_build_object('idempotency_key', key, 'status', status, 'flags', flags));
  end loop;

  return results;
end;
$$;

revoke all on function public.append_ledger_entries(text, jsonb, boolean) from public, anon;
grant execute on function public.append_ledger_entries(text, jsonb, boolean) to authenticated;
