-- Drop overly-permissive public SELECT policies on storage.objects
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
DROP POLICY IF EXISTS "org-logos public read" ON storage.objects;
DROP POLICY IF EXISTS "epis_fotos_public_read" ON storage.objects;

-- Recreate as authenticated-only listing.
-- Direct CDN reads still work because the buckets are flagged public=true,
-- which bypasses RLS for anonymous GETs on the object content URL.
CREATE POLICY "avatars_authenticated_list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "org_logos_authenticated_list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "epis_fotos_authenticated_list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'epis-fotos');