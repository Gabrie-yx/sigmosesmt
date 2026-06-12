
-- Endurece SELECT em buckets privados: exige is_viewer_or_above
DROP POLICY IF EXISTS "employee_docs_read_authed" ON storage.objects;
CREATE POLICY "employee_docs_read_authed" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-docs' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "vacc_select" ON storage.objects;
CREATE POLICY "vacc_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vaccination-cards' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "training_docs_select" ON storage.objects;
CREATE POLICY "training_docs_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'training-docs' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "sesmt_docs_storage_select" ON storage.objects;
CREATE POLICY "sesmt_docs_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sesmt-docs' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "dds_anexos_select" ON storage.objects;
CREATE POLICY "dds_anexos_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dds-anexos' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "procedimentos pdfs select" ON storage.objects;
CREATE POLICY "procedimentos pdfs select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'procedimentos-pdfs' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "controle-doc-select" ON storage.objects;
CREATE POLICY "controle-doc-select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'controle-documentos' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "checklists_equip_select" ON storage.objects;
CREATE POLICY "checklists_equip_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'checklists-equipamentos' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "OSS PDFs: select autenticado" ON storage.objects;
CREATE POLICY "OSS PDFs: select autenticado" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'oss-pdfs' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "Autenticados podem ver fotos extintores" ON storage.objects;
CREATE POLICY "Autenticados podem ver fotos extintores" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'extintores-fotos' AND public.is_viewer_or_above(auth.uid()));

-- Bônus: incident-photos também só checava bucket_id
DROP POLICY IF EXISTS "incident-photos: authenticated select" ON storage.objects;
CREATE POLICY "incident-photos: authenticated select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'incident-photos' AND public.is_viewer_or_above(auth.uid()));

DROP POLICY IF EXISTS "incident-photos: authenticated update" ON storage.objects;
CREATE POLICY "incident-photos: authenticated update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'incident-photos' AND public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "incident-photos: authenticated delete" ON storage.objects;
CREATE POLICY "incident-photos: authenticated delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'incident-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- CBO: restringe a authenticated (remove acesso anônimo)
DROP POLICY IF EXISTS "Anyone can read CBO" ON public.cbo_catalogo;
DROP POLICY IF EXISTS "cbo_catalogo_select_public" ON public.cbo_catalogo;
DROP POLICY IF EXISTS "cbo_catalogo_read" ON public.cbo_catalogo;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='cbo_catalogo' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.cbo_catalogo', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "cbo_catalogo_select_authenticated" ON public.cbo_catalogo
FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.cbo_catalogo FROM anon;
GRANT SELECT ON public.cbo_catalogo TO authenticated;
