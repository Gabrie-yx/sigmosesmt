ALTER TABLE public.document_template_versions
  ADD COLUMN IF NOT EXISTS overlay_map jsonb,
  ADD COLUMN IF NOT EXISTS overlay_status text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS overlay_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS overlay_atualizado_por uuid;