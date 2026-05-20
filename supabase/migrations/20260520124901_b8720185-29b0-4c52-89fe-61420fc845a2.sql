-- 1) Deduplicar movimentos MB51 mantendo o registro mais antigo de cada grupo
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento, COALESCE(classificacao_mb51,'')
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.producao_mb51_movimentos
)
DELETE FROM public.producao_mb51_movimentos m
USING ranked r
WHERE m.id = r.id AND r.rn > 1;

-- 2) Índice único para impedir reimportação duplicada
CREATE UNIQUE INDEX IF NOT EXISTS producao_mb51_movimentos_dedup_uidx
  ON public.producao_mb51_movimentos (
    numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento, COALESCE(classificacao_mb51,'')
  );