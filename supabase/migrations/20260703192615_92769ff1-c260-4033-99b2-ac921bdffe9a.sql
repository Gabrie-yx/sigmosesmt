-- Fatia 3: Devolução ao Solicitante + Recotação
ALTER TYPE public.purchase_req_status ADD VALUE IF NOT EXISTS 'DEVOLVIDA';

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS devolvida_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolvida_por_id uuid,
  ADD COLUMN IF NOT EXISTS devolvida_por_nome text,
  ADD COLUMN IF NOT EXISTS devolucao_mensagem text,
  ADD COLUMN IF NOT EXISTS recotacao_ciclos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_indeferimento_anterior text,
  ADD COLUMN IF NOT EXISTS recotacao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS recotacao_motivo text;