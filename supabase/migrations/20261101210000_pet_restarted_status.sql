-- New enum values cannot be used until this migration commits.
alter type public.pet_status add value if not exists 'restarted';

alter table public.pets add column if not exists restarted_at timestamptz;
