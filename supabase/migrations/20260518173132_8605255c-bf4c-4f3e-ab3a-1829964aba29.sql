ALTER TABLE public.producao_materiais
  ADD COLUMN IF NOT EXISTS classificacao_fiscal text,
  ADD COLUMN IF NOT EXISTS grupo_classif_contabil text;