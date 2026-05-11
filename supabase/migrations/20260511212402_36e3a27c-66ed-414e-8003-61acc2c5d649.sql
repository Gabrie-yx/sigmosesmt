
-- Adicionar campos para gerenciamento de motivo de entrega, empréstimo e perda
ALTER TABLE public.epi_deliveries
  ADD COLUMN IF NOT EXISTS motivo_entrega TEXT NOT NULL DEFAULT 'PRIMEIRA_ENTREGA',
  ADD COLUMN IF NOT EXISTS data_devolucao_prevista DATE,
  ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(10,2);

-- Validação de valores aceitos
ALTER TABLE public.epi_deliveries
  DROP CONSTRAINT IF EXISTS epi_deliveries_motivo_check;

ALTER TABLE public.epi_deliveries
  ADD CONSTRAINT epi_deliveries_motivo_check
  CHECK (motivo_entrega IN ('PRIMEIRA_ENTREGA','TROCA_DESGASTE','EMPRESTIMO','PERDA_EXTRAVIO'));

-- Índice para painel de empréstimos pendentes
CREATE INDEX IF NOT EXISTS idx_epi_deliveries_emprestimos_pendentes
  ON public.epi_deliveries (data_devolucao_prevista)
  WHERE motivo_entrega = 'EMPRESTIMO' AND data_devolucao IS NULL;
