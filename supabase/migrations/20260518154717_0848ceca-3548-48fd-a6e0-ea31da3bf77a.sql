
-- 1) Campos novos em trainings para suportar o painel de Cursos Ministrados
ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS modalidade text,           -- PRESENCIAL | ONLINE | HIBRIDA
  ADD COLUMN IF NOT EXISTS tipo_realizacao text,      -- INTERNO | EXTERNO | IN_COMPANY
  ADD COLUMN IF NOT EXISTS data_fim date;

-- 2) Tabela de anexos das turmas (lista de presença assinada, fotos, eficácia, reação)
CREATE TABLE IF NOT EXISTS public.training_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('LISTA_PRESENCA','FOTO','EFICACIA','REACAO','CERTIFICADO','OUTRO')),
  file_path text NOT NULL,
  descricao text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_anexos_training ON public.training_anexos(training_id);
CREATE INDEX IF NOT EXISTS idx_training_anexos_tipo ON public.training_anexos(training_id, tipo);

ALTER TABLE public.training_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_anexos_select ON public.training_anexos;
CREATE POLICY training_anexos_select ON public.training_anexos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS training_anexos_insert ON public.training_anexos;
CREATE POLICY training_anexos_insert ON public.training_anexos
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));

DROP POLICY IF EXISTS training_anexos_update ON public.training_anexos;
CREATE POLICY training_anexos_update ON public.training_anexos
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));

DROP POLICY IF EXISTS training_anexos_delete ON public.training_anexos;
CREATE POLICY training_anexos_delete ON public.training_anexos
  FOR DELETE TO authenticated USING (is_editor(auth.uid()));
