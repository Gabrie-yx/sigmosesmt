
-- 1. Bucket público para fotos de EPIs
INSERT INTO storage.buckets (id, name, public)
VALUES ('epis-fotos', 'epis-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies (idempotentes)
DROP POLICY IF EXISTS "epis_fotos_public_read" ON storage.objects;
CREATE POLICY "epis_fotos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'epis-fotos');

DROP POLICY IF EXISTS "epis_fotos_editor_insert" ON storage.objects;
CREATE POLICY "epis_fotos_editor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'epis-fotos' AND public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "epis_fotos_editor_update" ON storage.objects;
CREATE POLICY "epis_fotos_editor_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'epis-fotos' AND public.is_editor(auth.uid()));

DROP POLICY IF EXISTS "epis_fotos_admin_delete" ON storage.objects;
CREATE POLICY "epis_fotos_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'epis-fotos' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 2. FK entre historico_entregas.epi_id e estoque_epi.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'historico_entregas_epi_id_fkey'
      AND table_name = 'historico_entregas'
  ) THEN
    ALTER TABLE public.historico_entregas
      ADD CONSTRAINT historico_entregas_epi_id_fkey
      FOREIGN KEY (epi_id) REFERENCES public.estoque_epi(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. Índices para buscas no dossiê
CREATE INDEX IF NOT EXISTS idx_historico_cpf ON public.historico_entregas (cpf_colaborador);
CREATE INDEX IF NOT EXISTS idx_historico_data ON public.historico_entregas (data_entrega DESC);
