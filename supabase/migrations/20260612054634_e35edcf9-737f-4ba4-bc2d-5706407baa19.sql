ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS pis text,
  ADD COLUMN IF NOT EXISTS assinatura_url text;