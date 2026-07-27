ALTER TABLE public.document_template_versions
  ADD COLUMN IF NOT EXISTS origem_path text,
  ADD COLUMN IF NOT EXISTS origem_nome text,
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_tamanho bigint;

DROP POLICY IF EXISTS "auth read versions" ON public.document_template_versions;
CREATE POLICY "admin read versions" ON public.document_template_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth read pendencias" ON public.document_template_pendencias;
CREATE POLICY "admin read pendencias" ON public.document_template_pendencias
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "temp_public_read_templates" ON storage.objects;