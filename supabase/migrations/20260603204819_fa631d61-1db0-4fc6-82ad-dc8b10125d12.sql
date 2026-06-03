-- 1) Coluna de evidências
ALTER TABLE public.acidentes_trabalho
  ADD COLUMN IF NOT EXISTS evidencias_urls text[] NOT NULL DEFAULT '{}'::text[];

-- 2) Políticas no bucket incident-photos (privado)
-- Permitir que qualquer usuário autenticado leia, faça upload, atualize e remova fotos do bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='incident-photos: authenticated select') THEN
    CREATE POLICY "incident-photos: authenticated select"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'incident-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='incident-photos: authenticated insert') THEN
    CREATE POLICY "incident-photos: authenticated insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'incident-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='incident-photos: authenticated update') THEN
    CREATE POLICY "incident-photos: authenticated update"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'incident-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='incident-photos: authenticated delete') THEN
    CREATE POLICY "incident-photos: authenticated delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'incident-photos');
  END IF;
END $$;