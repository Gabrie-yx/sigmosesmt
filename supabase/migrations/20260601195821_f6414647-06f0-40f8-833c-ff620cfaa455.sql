-- =====================================================
-- MÓDULO OSS (Ordem de Serviço de Segurança) — NR-01
-- =====================================================

CREATE TYPE public.oss_status AS ENUM (
  'PENDENTE_ASSINATURA',
  'ASSINADO',
  'VENCIDO',
  'SUBSTITUIDO'
);

CREATE TYPE public.oss_motivo AS ENUM (
  'ADMISSAO',
  'MUDANCA_CARGO',
  'REVISAO_RISCO',
  'RECICLAGEM_ANUAL',
  'EMISSAO_MANUAL'
);

-- =====================================================
-- TABELA 1: oss_templates
-- =====================================================
CREATE TABLE public.oss_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  setor TEXT,
  descricao_atividades TEXT NOT NULL DEFAULT '',
  riscos_texto TEXT NOT NULL DEFAULT '',
  medidas_preventivas TEXT NOT NULL DEFAULT '',
  epis_obrigatorios TEXT NOT NULL DEFAULT '',
  proibicoes TEXT NOT NULL DEFAULT '',
  penalidades TEXT NOT NULL DEFAULT 'O descumprimento das normas de segurança contidas nesta Ordem de Serviço sujeita o trabalhador às penalidades previstas no art. 158 da CLT (advertência, suspensão e demissão por justa causa).',
  procedimentos_emergencia TEXT NOT NULL DEFAULT '',
  validade_meses INT NOT NULL DEFAULT 12,
  revisao INT NOT NULL DEFAULT 1,
  hash_conteudo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oss_templates TO authenticated;
GRANT ALL ON public.oss_templates TO service_role;

ALTER TABLE public.oss_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OSS templates: leitura autenticada"
ON public.oss_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "OSS templates: insert editor+"
ON public.oss_templates FOR INSERT TO authenticated
WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "OSS templates: update editor+"
ON public.oss_templates FOR UPDATE TO authenticated
USING (public.is_editor(auth.uid()))
WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "OSS templates: delete admin"
ON public.oss_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_oss_templates_updated_at
BEFORE UPDATE ON public.oss_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hash via md5 (built-in)
CREATE OR REPLACE FUNCTION public.oss_templates_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_hash TEXT;
BEGIN
  v_new_hash := md5(
    coalesce(NEW.descricao_atividades,'') || '|' ||
    coalesce(NEW.riscos_texto,'') || '|' ||
    coalesce(NEW.medidas_preventivas,'') || '|' ||
    coalesce(NEW.epis_obrigatorios,'') || '|' ||
    coalesce(NEW.proibicoes,'') || '|' ||
    coalesce(NEW.procedimentos_emergencia,'')
  );
  IF TG_OP = 'UPDATE' AND OLD.hash_conteudo IS NOT NULL AND OLD.hash_conteudo IS DISTINCT FROM v_new_hash THEN
    NEW.revisao := COALESCE(OLD.revisao, 1) + 1;
  END IF;
  NEW.hash_conteudo := v_new_hash;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oss_templates_hash
BEFORE INSERT OR UPDATE ON public.oss_templates
FOR EACH ROW EXECUTE FUNCTION public.oss_templates_before_write();

-- =====================================================
-- TABELA 2: oss_emissoes
-- =====================================================
CREATE TABLE public.oss_emissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.oss_templates(id) ON DELETE RESTRICT,
  template_revisao INT NOT NULL,
  cargo_snapshot TEXT NOT NULL,
  conteudo_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_gerado_path TEXT,
  pdf_assinado_path TEXT,
  status public.oss_status NOT NULL DEFAULT 'PENDENTE_ASSINATURA',
  motivo_emissao public.oss_motivo NOT NULL DEFAULT 'EMISSAO_MANUAL',
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  assinado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  observacoes TEXT,
  emitido_por UUID,
  validado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oss_emissoes_employee ON public.oss_emissoes(employee_id);
CREATE INDEX idx_oss_emissoes_template ON public.oss_emissoes(template_id);
CREATE INDEX idx_oss_emissoes_status ON public.oss_emissoes(status);
CREATE INDEX idx_oss_emissoes_expira ON public.oss_emissoes(expira_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oss_emissoes TO authenticated;
GRANT ALL ON public.oss_emissoes TO service_role;

ALTER TABLE public.oss_emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OSS emissoes: leitura autenticada"
ON public.oss_emissoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "OSS emissoes: insert editor+"
ON public.oss_emissoes FOR INSERT TO authenticated
WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "OSS emissoes: update editor+"
ON public.oss_emissoes FOR UPDATE TO authenticated
USING (public.is_editor(auth.uid()))
WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "OSS emissoes: delete admin"
ON public.oss_emissoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_oss_emissoes_updated_at
BEFORE UPDATE ON public.oss_emissoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.oss_emissoes_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses INT;
BEGIN
  IF NEW.expira_em IS NULL THEN
    SELECT validade_meses INTO v_meses FROM public.oss_templates WHERE id = NEW.template_id;
    NEW.expira_em := NEW.emitido_em + (COALESCE(v_meses, 12) || ' months')::INTERVAL;
  END IF;
  IF NEW.emitido_por IS NULL THEN
    NEW.emitido_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oss_emissoes_before_insert
BEFORE INSERT ON public.oss_emissoes
FOR EACH ROW EXECUTE FUNCTION public.oss_emissoes_before_insert();

-- Trigger: mudança de cargo
CREATE OR REPLACE FUNCTION public.oss_on_employee_cargo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.cargo IS DISTINCT FROM NEW.cargo THEN
    UPDATE public.oss_emissoes
       SET status = 'SUBSTITUIDO', updated_at = now()
     WHERE employee_id = NEW.id
       AND status IN ('PENDENTE_ASSINATURA', 'ASSINADO');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oss_employee_cargo_change
AFTER UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.oss_on_employee_cargo_change();

-- Trigger: mudança de revisão do template
CREATE OR REPLACE FUNCTION public.oss_on_template_revision_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.revisao IS DISTINCT FROM NEW.revisao THEN
    UPDATE public.oss_emissoes
       SET status = 'SUBSTITUIDO', updated_at = now()
     WHERE template_id = NEW.id
       AND template_revisao < NEW.revisao
       AND status IN ('PENDENTE_ASSINATURA', 'ASSINADO');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oss_template_revision
AFTER UPDATE ON public.oss_templates
FOR EACH ROW EXECUTE FUNCTION public.oss_on_template_revision_change();

-- Marcar vencidas
CREATE OR REPLACE FUNCTION public.oss_marcar_vencidas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH updated AS (
    UPDATE public.oss_emissoes
       SET status = 'VENCIDO', updated_at = now()
     WHERE status IN ('PENDENTE_ASSINATURA', 'ASSINADO')
       AND expira_em IS NOT NULL
       AND expira_em < now()
     RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- STORAGE bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('oss-pdfs', 'oss-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "OSS PDFs: select autenticado"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'oss-pdfs');

CREATE POLICY "OSS PDFs: insert editor+"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'oss-pdfs' AND public.is_editor(auth.uid()));

CREATE POLICY "OSS PDFs: update editor+"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'oss-pdfs' AND public.is_editor(auth.uid()));

CREATE POLICY "OSS PDFs: delete admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'oss-pdfs' AND public.has_role(auth.uid(), 'admin'::public.app_role));