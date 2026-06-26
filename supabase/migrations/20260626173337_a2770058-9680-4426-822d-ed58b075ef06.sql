-- Performance: evitar carregar colunas data-URL gigantes só para exibir bolinhas verdes.
ALTER TABLE public.employee_saidas_expediente
  ADD COLUMN IF NOT EXISTS sig_func boolean GENERATED ALWAYS AS (assinatura_funcionario IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS sig_sesmt boolean GENERATED ALWAYS AS (assinatura_sesmt IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS sig_supervisor boolean GENERATED ALWAYS AS (assinatura_supervisor IS NOT NULL) STORED;

-- Índice de cobertura para a listagem dos últimos 12 meses
CREATE INDEX IF NOT EXISTS idx_saidas_data_created
  ON public.employee_saidas_expediente (data DESC, created_at DESC);

-- Hora extra: índice para o join principal
CREATE INDEX IF NOT EXISTS idx_he_funcionarios_he_id_ordem
  ON public.hora_extra_sabado_funcionarios (hora_extra_id, ordem);

ANALYZE public.employee_saidas_expediente;
ANALYZE public.hora_extra_sabado_funcionarios;