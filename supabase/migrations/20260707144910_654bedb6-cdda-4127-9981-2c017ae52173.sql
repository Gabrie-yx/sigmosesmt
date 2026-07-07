
CREATE POLICY "portaria_fotos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portaria-fotos'
    AND (
      public.has_role(auth.uid(),'porteiro'::app_role)
      OR public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'tst'::app_role)
    )
  );

CREATE POLICY "portaria_fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portaria-fotos');

CREATE POLICY "portaria_fotos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'portaria-fotos'
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'tst'::app_role))
  );
