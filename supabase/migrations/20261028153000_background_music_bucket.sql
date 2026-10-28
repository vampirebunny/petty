-- Public scene-music bucket. The app downloads tracks by URL and does not read a table.
-- Hosted Storage rejects DELETE on storage.objects and storage.buckets, so this
-- leaves an existing bucket in place and only makes sure it is public.

insert into storage.buckets (id, name, public)
values ('background-music', 'background-music', true)
on conflict (id) do update
set public = true;

drop policy if exists background_music_public_read on storage.objects;

create policy background_music_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'background-music');
