
-- Limpa duplicatas: mantém linha com classificacao_mb51 preenchida quando houver
WITH d AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY ordem_id, material, data_lancamento, quantidade, unidade, tipo_movimento
      ORDER BY (classificacao_mb51 IS NULL) ASC, id ASC
    ) AS rn
  FROM public.producao_mb51_movimentos
)
DELETE FROM public.producao_mb51_movimentos m USING d WHERE m.id = d.id AND d.rn > 1;

-- Recria chave de deduplicação sem classificacao_mb51 (campo opcional na MB51)
DROP INDEX IF EXISTS public.producao_mb51_movimentos_dedupe_key;
CREATE UNIQUE INDEX producao_mb51_movimentos_dedupe_key
  ON public.producao_mb51_movimentos
  (ordem_id, material, data_lancamento, quantidade, unidade, tipo_movimento);

-- Recalcula qtd_movimentos / qtd_consumo_liquido nas ordens
UPDATE public.producao_mb51_ordens o SET
  qtd_movimentos = sub.qtd,
  qtd_consumo_liquido = sub.liq
FROM (
  SELECT ordem_id, COUNT(*) AS qtd, COALESCE(SUM(-quantidade), 0) AS liq
  FROM public.producao_mb51_movimentos
  GROUP BY ordem_id
) sub
WHERE sub.ordem_id = o.id;
