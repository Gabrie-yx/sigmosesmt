-- Allow editors/admins to manage employee profile photos in the avatars bucket
-- using a dedicated employees/<employee_id>/... folder.
DROP POLICY IF EXISTS "employee_avatar_photos_insert_editor" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatar_photos_update_editor" ON storage.objects;
DROP POLICY IF EXISTS "employee_avatar_photos_delete_editor" ON storage.objects;

CREATE POLICY "employee_avatar_photos_insert_editor"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND public.is_editor(auth.uid())
);

CREATE POLICY "employee_avatar_photos_update_editor"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND public.is_editor(auth.uid())
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND public.is_editor(auth.uid())
);

CREATE POLICY "employee_avatar_photos_delete_editor"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND public.is_editor(auth.uid())
);

-- The trigger function is internal and should not be directly callable by anonymous users.
REVOKE EXECUTE ON FUNCTION public.sync_employee_tipo_vinculo() FROM PUBLIC, anon;