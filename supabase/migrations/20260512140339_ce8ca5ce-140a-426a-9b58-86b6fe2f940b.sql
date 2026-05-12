ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS matriz_nome text,
  ADD COLUMN IF NOT EXISTS matriz_cnpj text;