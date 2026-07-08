
-- Validação de hora extra pela portaria
-- Dia útil: portaria confirma permanência às 17h + registra saída real depois
-- Sábado: portaria registra entrada + saída real

ALTER TABLE public.hora_extra_sabado_funcionarios
  ADD COLUMN IF NOT EXISTS permanencia_confirmada_at timestamptz,
  ADD COLUMN IF NOT EXISTS permanencia_confirmada_por uuid,
  ADD COLUMN IF NOT EXISTS permanencia_confirmada_por_nome text,
  ADD COLUMN IF NOT EXISTS entrada_confirmada_at timestamptz,
  ADD COLUMN IF NOT EXISTS entrada_confirmada_por uuid,
  ADD COLUMN IF NOT EXISTS entrada_confirmada_por_nome text,
  ADD COLUMN IF NOT EXISTS saida_confirmada_at timestamptz,
  ADD COLUMN IF NOT EXISTS saida_confirmada_por uuid,
  ADD COLUMN IF NOT EXISTS saida_confirmada_por_nome text;

-- Índice para o card "Hora Extra Hoje" da portaria filtrar rápido por convocação
CREATE INDEX IF NOT EXISTS idx_hesf_hora_extra_id
  ON public.hora_extra_sabado_funcionarios (hora_extra_id)
  WHERE deleted_at IS NULL;
