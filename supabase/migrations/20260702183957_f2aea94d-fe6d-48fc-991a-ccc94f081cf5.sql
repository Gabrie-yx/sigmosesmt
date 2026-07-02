
ALTER TABLE public.assinaturas_termos_consentimento
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- RLS policies for termos-consentimento bucket
CREATE POLICY "Termos consentimento — leitura autenticada"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'termos-consentimento');

CREATE POLICY "Termos consentimento — upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'termos-consentimento');

CREATE POLICY "Termos consentimento — update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'termos-consentimento');

CREATE POLICY "Termos consentimento — delete admin/moderador"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'termos-consentimento' AND public.is_moderator(auth.uid()));
