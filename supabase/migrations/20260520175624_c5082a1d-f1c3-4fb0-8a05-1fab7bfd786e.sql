WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.producao_mb51_movimentos
)
DELETE FROM public.producao_mb51_movimentos m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS public.producao_mb51_movimentos_dedup_uidx;

CREATE UNIQUE INDEX producao_mb51_movimentos_dedup_uidx
  ON public.producao_mb51_movimentos (
    numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento
  ) NULLS NOT DISTINCT;