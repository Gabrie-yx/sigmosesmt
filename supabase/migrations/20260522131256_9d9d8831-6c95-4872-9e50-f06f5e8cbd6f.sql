
-- 1. Adicionar novo valor ao enum (COTADA entre PENDENTE e APROVADA)
ALTER TYPE public.purchase_req_status ADD VALUE IF NOT EXISTS 'COTADA' BEFORE 'APROVADA';

-- 2. Adicionar colunas
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS status_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cotacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS cotador_nome text,
  ADD COLUMN IF NOT EXISTS cotacao_fornecedor text,
  ADD COLUMN IF NOT EXISTS cotacao_valor numeric(14,2);

-- 3. Índice único para lookup rápido
CREATE UNIQUE INDEX IF NOT EXISTS purchase_requisitions_status_token_idx
  ON public.purchase_requisitions (status_token);
