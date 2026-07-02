
-- 1) Novas colunas em purchase_requisitions
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS pego_por_compras_id uuid,
  ADD COLUMN IF NOT EXISTS pego_por_compras_nome text,
  ADD COLUMN IF NOT EXISTS pego_em timestamptz,
  ADD COLUMN IF NOT EXISTS decidido_por_id uuid,
  ADD COLUMN IF NOT EXISTS decidido_por_nome text,
  ADD COLUMN IF NOT EXISTS decidido_assinatura_url text,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_status ON public.purchase_requisitions(status);

-- 2) Eleição do Supervisor Geral em company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS supervisor_geral_user_id uuid;

-- 3) Função de gate: quem pode deferir/indeferir RC
CREATE OR REPLACE FUNCTION public.is_supervisor_geral(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.company_settings
      WHERE supervisor_geral_user_id = _user_id
    );
$$;

-- 4) Trigger de audit em mudanças de status da RC (rastreabilidade ISO 9001)
CREATE OR REPLACE FUNCTION public.tg_purchase_requisition_audit_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
      VALUES (
        auth.uid(),
        'RC_STATUS_CHANGE',
        'purchase_requisitions',
        NEW.id,
        jsonb_build_object(
          'numero', NEW.numero,
          'de', OLD.status,
          'para', NEW.status,
          'cotador', NEW.cotador_nome,
          'decidido_por', NEW.decidido_por_nome,
          'motivo', NEW.motivo_indeferimento
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_requisition_audit_status ON public.purchase_requisitions;
CREATE TRIGGER trg_purchase_requisition_audit_status
AFTER UPDATE ON public.purchase_requisitions
FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_requisition_audit_status();
