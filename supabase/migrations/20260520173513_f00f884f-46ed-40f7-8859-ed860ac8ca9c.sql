-- Substitui o índice funcional por um índice de colunas simples com NULLS NOT DISTINCT,
-- para casar com o onConflict do upsert no cliente.
DROP INDEX IF EXISTS public.producao_mb51_movimentos_dedup_uidx;

CREATE UNIQUE INDEX producao_mb51_movimentos_dedup_uidx
  ON public.producao_mb51_movimentos (
    numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento, classificacao_mb51
  ) NULLS NOT DISTINCT;