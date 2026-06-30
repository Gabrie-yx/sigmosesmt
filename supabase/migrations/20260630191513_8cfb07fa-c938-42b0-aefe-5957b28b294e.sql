-- Termo de Consentimento para uso de assinatura eletrônica simples (Lei 14.063/2020 + LGPD art. 7º V)
CREATE TABLE public.assinaturas_termos_consentimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data_assinatura DATE NOT NULL DEFAULT CURRENT_DATE,
  assinatura_snapshot TEXT,             -- PNG dataURL/URL da assinatura no momento do termo
  pdf_url TEXT,                         -- PDF gerado e arquivado
  hash_sha256 TEXT,                     -- Hash do PDF para integridade
  ip_origem TEXT,
  user_agent TEXT,
  coletado_por UUID,                    -- usuário SIGMO que coletou
  coletado_por_nome TEXT,
  observacoes TEXT,
  revogado_em TIMESTAMPTZ,
  revogado_por UUID,
  motivo_revogacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas_termos_consentimento TO authenticated;
GRANT ALL ON public.assinaturas_termos_consentimento TO service_role;

ALTER TABLE public.assinaturas_termos_consentimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers leem termos" ON public.assinaturas_termos_consentimento
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "Editors gerenciam termos" ON public.assinaturas_termos_consentimento
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Editors atualizam termos" ON public.assinaturas_termos_consentimento
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Admins deletam termos" ON public.assinaturas_termos_consentimento
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_termos_employee ON public.assinaturas_termos_consentimento(employee_id) WHERE revogado_em IS NULL;
CREATE INDEX idx_termos_data ON public.assinaturas_termos_consentimento(data_assinatura);

CREATE TRIGGER trg_termos_updated_at BEFORE UPDATE ON public.assinaturas_termos_consentimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atalho na ficha do funcionário: último termo ativo
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS termo_consentimento_id UUID REFERENCES public.assinaturas_termos_consentimento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_consentimento_data DATE;

-- Trigger sincroniza ficha quando um termo é criado/revogado
CREATE OR REPLACE FUNCTION public.sync_employee_termo_consentimento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.revogado_em IS NULL THEN
    UPDATE public.employees
       SET termo_consentimento_id = NEW.id,
           termo_consentimento_data = NEW.data_assinatura
     WHERE id = NEW.employee_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.revogado_em IS NULL AND NEW.revogado_em IS NOT NULL THEN
    -- revogado: limpa atalho se for esse termo
    UPDATE public.employees
       SET termo_consentimento_id = NULL,
           termo_consentimento_data = NULL
     WHERE id = NEW.employee_id AND termo_consentimento_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_employee_termo
  AFTER INSERT OR UPDATE ON public.assinaturas_termos_consentimento
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_termo_consentimento();

-- View útil pro painel "Hoje"
CREATE OR REPLACE VIEW public.v_termos_consentimento_status AS
SELECT
  e.id AS employee_id,
  e.nome,
  e.company_id,
  e.assinatura_url,
  e.termo_consentimento_id,
  e.termo_consentimento_data,
  CASE
    WHEN e.assinatura_url IS NULL THEN 'SEM_ASSINATURA'
    WHEN e.termo_consentimento_id IS NULL THEN 'PENDENTE_TERMO'
    ELSE 'BLINDADO'
  END AS status_probatorio
FROM public.employees e
WHERE e.status = 'ATIVO';

GRANT SELECT ON public.v_termos_consentimento_status TO authenticated;