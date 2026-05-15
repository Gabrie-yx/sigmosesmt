ALTER TABLE public.dds
  ADD COLUMN IF NOT EXISTS hora_fim time without time zone,
  ADD COLUMN IF NOT EXISTS encarregado text,
  ADD COLUMN IF NOT EXISTS responsavel_sesmt text,
  ADD COLUMN IF NOT EXISTS company_id uuid;