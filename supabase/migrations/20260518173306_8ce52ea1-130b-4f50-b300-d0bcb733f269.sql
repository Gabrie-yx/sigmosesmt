ALTER TABLE public.producao_materiais
  DROP COLUMN IF EXISTS classificacao_fiscal,
  DROP COLUMN IF EXISTS grupo_classif_contabil;

ALTER TABLE public.producao_ordem_itens
  ADD COLUMN IF NOT EXISTS classificacao_fiscal text,
  ADD COLUMN IF NOT EXISTS grupo_classif_contabil text,
  ADD COLUMN IF NOT EXISTS org_vendas text,
  ADD COLUMN IF NOT EXISTS canal_distribuicao text;

ALTER TABLE public.producao_ordens
  ADD COLUMN IF NOT EXISTS mtart text;