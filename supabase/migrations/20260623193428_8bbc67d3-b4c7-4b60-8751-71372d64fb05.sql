-- Remove duplicatas existentes antes de criar a unique
DELETE FROM public.producao_mb51_movimentos a
USING public.producao_mb51_movimentos b
WHERE a.ctid < b.ctid
  AND a.numero_sap = b.numero_sap
  AND a.material = b.material
  AND a.data_lancamento = b.data_lancamento
  AND a.quantidade = b.quantidade
  AND a.unidade = b.unidade
  AND a.tipo_movimento = b.tipo_movimento
  AND COALESCE(a.classificacao_mb51,'') = COALESCE(b.classificacao_mb51,'');

CREATE UNIQUE INDEX IF NOT EXISTS producao_mb51_movimentos_dedupe_key
ON public.producao_mb51_movimentos (
  numero_sap, material, data_lancamento, quantidade, unidade, tipo_movimento, classificacao_mb51
);