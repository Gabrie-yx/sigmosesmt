-- Fatia 2: Emissão de Pedido de Compra + Recebimento (NF)
ALTER TYPE public.purchase_req_status ADD VALUE IF NOT EXISTS 'EM_RECEBIMENTO';
ALTER TYPE public.purchase_req_status ADD VALUE IF NOT EXISTS 'CONCLUIDA';

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS pc_numero text,
  ADD COLUMN IF NOT EXISTS pc_fornecedor text,
  ADD COLUMN IF NOT EXISTS pc_valor numeric(14,2),
  ADD COLUMN IF NOT EXISTS pc_prazo_entrega date,
  ADD COLUMN IF NOT EXISTS pc_arquivo_url text,
  ADD COLUMN IF NOT EXISTS pc_arquivo_nome text,
  ADD COLUMN IF NOT EXISTS pc_observacoes text,
  ADD COLUMN IF NOT EXISTS pc_emitido_por_id uuid,
  ADD COLUMN IF NOT EXISTS pc_emitido_por_nome text,
  ADD COLUMN IF NOT EXISTS pc_emitido_em timestamptz,
  ADD COLUMN IF NOT EXISTS nf_numero text,
  ADD COLUMN IF NOT EXISTS nf_arquivo_url text,
  ADD COLUMN IF NOT EXISTS nf_arquivo_nome text,
  ADD COLUMN IF NOT EXISTS nf_observacoes text,
  ADD COLUMN IF NOT EXISTS recebido_em timestamptz,
  ADD COLUMN IF NOT EXISTS recebido_por_id uuid,
  ADD COLUMN IF NOT EXISTS recebido_por_nome text;

CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_status
  ON public.purchase_requisitions (status);