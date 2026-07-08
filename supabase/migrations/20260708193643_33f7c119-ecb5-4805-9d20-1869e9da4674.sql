
ALTER TABLE public.cal_planos_acao
  ADD COLUMN IF NOT EXISTS requisito_legal_texto text,
  ADD COLUMN IF NOT EXISTS area_pa text,
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.cal_evidencias
  ADD COLUMN IF NOT EXISTS plano_id uuid REFERENCES public.cal_planos_acao(id) ON DELETE CASCADE;

ALTER TABLE public.cal_evidencias ALTER COLUMN requisito_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cal_evidencias_plano ON public.cal_evidencias(plano_id);
