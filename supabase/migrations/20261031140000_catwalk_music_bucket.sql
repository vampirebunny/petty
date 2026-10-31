-- Public Catwalk runway tracks. The app downloads by URL the same way as background-music.
-- Hosted Storage rejects DELETE on storage.objects and storage.buckets, so this
-- leaves an existing bucket in place and only makes sure it is public.

insert into storage.buckets (id, name, public)
values ('catwalk-music', 'catwalk-music', true)
on conflict (id) do update
set public = true;

drop policy if exists catwalk_music_public_read on storage.objects;

create policy catwalk_music_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'catwalk-music');
