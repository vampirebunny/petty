-- 20261028170000 already ran before these grants existed.
-- service_role can truncate the new tables but cannot insert, so the webhook returned unavailable.

grant select, insert, update on public.webhook_events to service_role;
grant select on public.boops_packs to service_role;
