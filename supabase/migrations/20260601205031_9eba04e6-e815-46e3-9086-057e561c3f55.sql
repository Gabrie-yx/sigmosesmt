ALTER TABLE public.oss_templates
  ADD COLUMN IF NOT EXISTS risco_fisico text,
  ADD COLUMN IF NOT EXISTS risco_quimico text,
  ADD COLUMN IF NOT EXISTS risco_biologico text,
  ADD COLUMN IF NOT EXISTS risco_ergonomico text,
  ADD COLUMN IF NOT EXISTS risco_acidente text;