ALTER TABLE public.desligamento_pacotes ADD COLUMN IF NOT EXISTS pdf_url TEXT;

CREATE POLICY "Autenticados leem pacotes de desligamento"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'desligamento-pacotes');

CREATE POLICY "Autenticados enviam pacotes de desligamento"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'desligamento-pacotes');