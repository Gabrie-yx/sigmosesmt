-- Tabela de overrides (liberações manuais) para destravar bloqueios de SST
-- Atende ISO 9001: rastreabilidade total (quem, quando, por quê, até quando)
CREATE TABLE public.safety_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'ITEM')),
  -- item_key: NULL quando scope=GLOBAL. Quando scope=ITEM, identifica o bloqueio:
  --   'ASO', 'INTEGRACAO', 'NR-35', 'EXAME:Audiometria', 'VACINA:Hepatite B', 'PTE'
  item_key TEXT,
  justificativa TEXT NOT NULL,
  liberado_por UUID NOT NULL,
  liberado_por_email TEXT,
  liberado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- expira_em: NULL = indefinido / até revogar manualmente
  expira_em TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT true,
  revogado_por UUID,
  revogado_em TIMESTAMPTZ,
  motivo_revogacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_item_key CHECK (
    (scope = 'GLOBAL' AND item_key IS NULL) OR
    (scope = 'ITEM' AND item_key IS NOT NULL)
  )
);

CREATE INDEX idx_safety_overrides_emp ON public.safety_overrides(employee_id) WHERE ativo = true;
CREATE INDEX idx_safety_overrides_active ON public.safety_overrides(ativo, expira_em);

ALTER TABLE public.safety_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: todos autenticados podem ler (transparência)
CREATE POLICY safety_overrides_select ON public.safety_overrides
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: somente admin
CREATE POLICY safety_overrides_insert ON public.safety_overrides
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND liberado_por = auth.uid());

CREATE POLICY safety_overrides_update ON public.safety_overrides
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY safety_overrides_delete ON public.safety_overrides
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de auditoria (reaproveita log_audit_event existente)
CREATE TRIGGER audit_safety_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.safety_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();