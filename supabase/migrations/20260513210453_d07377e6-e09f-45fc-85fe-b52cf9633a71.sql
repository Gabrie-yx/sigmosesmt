ALTER TABLE public.producao_tipos_produto
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS grupo_mercadorias text;