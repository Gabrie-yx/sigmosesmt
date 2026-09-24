ALTER TABLE public.controle_documentos
  ADD COLUMN IF NOT EXISTS data_validade date,
  ADD COLUMN IF NOT EXISTS dias_alerta integer,
  ADD COLUMN IF NOT EXISTS alerta_adiado_ate date,
  ADD COLUMN IF NOT EXISTS alerta_silenciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_silenciado_por uuid,
  ADD COLUMN IF NOT EXISTS alerta_silenciado_motivo text;
ALTER TABLE public.controle_doc_categorias
  ADD COLUMN IF NOT EXISTS dias_alerta_padrao integer;
NOTIFY pgrst, 'reload schema';