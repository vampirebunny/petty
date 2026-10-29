-- App-wide minimum version. Null means every binary may open.
-- Clients can read this before sign-in. They cannot write it.
-- Kept off shop_config so raising the minimum does not bump the shop catalog.

create table public.app_config (
  id int primary key,
  min_app_version text,
  constraint app_config_singleton check (id = 1)
);

alter table public.app_config enable row level security;

revoke all on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

create policy app_config_read on public.app_config for select to anon, authenticated using (true);

insert into public.app_config (id, min_app_version) values (1, null);
