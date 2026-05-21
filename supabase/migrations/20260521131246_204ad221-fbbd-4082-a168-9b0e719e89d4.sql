
-- =============================================
-- Matriz de Controle de Documentos
-- =============================================

-- 1. Categorias
CREATE TABLE public.controle_doc_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  criticidade_sugerida text NOT NULL DEFAULT 'MEDIA' CHECK (criticidade_sugerida IN ('CRITICA','ALTA','MEDIA','BAIXA')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Recorrentes (catálogo de documentos com vencimento)
CREATE TABLE public.controle_doc_recorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.controle_doc_categorias(id) ON DELETE SET NULL,
  criticidade text NOT NULL DEFAULT 'MEDIA' CHECK (criticidade IN ('CRITICA','ALTA','MEDIA','BAIXA')),
  responsavel_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  periodicidade_meses int NOT NULL DEFAULT 12,
  dias_aviso_previo int NOT NULL DEFAULT 30,
  proxima_validade date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- 3. Documentos (matriz principal)
CREATE TABLE public.controle_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  origem text NOT NULL DEFAULT 'EMAIL' CHECK (origem IN ('EMAIL','WHATSAPP','OFICIO','AUDITORIA','INTERNO','RECORRENTE_AUTO','OUTRO')),
  remetente_nome text,
  remetente_contato text,
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  prazo date,
  data_resolucao date,
  categoria_id uuid REFERENCES public.controle_doc_categorias(id) ON DELETE SET NULL,
  criticidade text NOT NULL DEFAULT 'MEDIA' CHECK (criticidade IN ('CRITICA','ALTA','MEDIA','BAIXA')),
  responsavel_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  tratativa text,
  status text NOT NULL DEFAULT 'RECEBIDO' CHECK (status IN ('RECEBIDO','EM_ANALISE','EM_TRATATIVA','AGUARDANDO_TERCEIRO','RESOLVIDO','CANCELADO')),
  terceiro_nome text,
  terceiro_followup_em date,
  recorrente_id uuid REFERENCES public.controle_doc_recorrentes(id) ON DELETE SET NULL,
  observacao_fechamento text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_controle_doc_status ON public.controle_documentos(status);
CREATE INDEX idx_controle_doc_responsavel ON public.controle_documentos(responsavel_id);
CREATE INDEX idx_controle_doc_prazo ON public.controle_documentos(prazo);
CREATE INDEX idx_controle_doc_recorrente ON public.controle_documentos(recorrente_id);

-- 4. Anexos
CREATE TABLE public.controle_doc_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.controle_documentos(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  nome_original text,
  tipo text NOT NULL DEFAULT 'ORIGEM' CHECK (tipo IN ('ORIGEM','REFERENCIA','EVIDENCIA_RESOLUCAO')),
  descricao text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);

CREATE INDEX idx_controle_doc_anexos_doc ON public.controle_doc_anexos(documento_id);

-- 5. Histórico
CREATE TABLE public.controle_doc_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.controle_documentos(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor_anterior text,
  valor_novo text,
  alterado_por uuid,
  alterado_por_email text,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_controle_doc_hist_doc ON public.controle_doc_historico(documento_id);

-- =============================================
-- Functions / Triggers
-- =============================================

-- Numeração sequencial CD-YYYY-NNNN
CREATE OR REPLACE FUNCTION public.gerar_numero_controle_doc()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano text := to_char(CURRENT_DATE, 'YYYY');
  v_seq int;
BEGIN
  SELECT COALESCE(MAX(substring(numero from '^CD-\d{4}-(\d+)$')::int), 0) + 1
    INTO v_seq
    FROM public.controle_documentos
   WHERE numero ~ ('^CD-' || v_ano || '-\d+$');
  RETURN 'CD-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- Trigger BEFORE INSERT: número + criticidade da categoria
CREATE OR REPLACE FUNCTION public.controle_doc_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_controle_doc();
  END IF;
  IF NEW.criticidade IS NULL OR NEW.criticidade = 'MEDIA' THEN
    -- só sobrescreve se veio do default; se categoria tiver sugestão usa
    IF NEW.categoria_id IS NOT NULL THEN
      SELECT criticidade_sugerida INTO NEW.criticidade
        FROM public.controle_doc_categorias WHERE id = NEW.categoria_id;
      IF NEW.criticidade IS NULL THEN NEW.criticidade := 'MEDIA'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_controle_doc_before_insert
  BEFORE INSERT ON public.controle_documentos
  FOR EACH ROW EXECUTE FUNCTION public.controle_doc_before_insert();

-- Trigger updated_at
CREATE TRIGGER trg_controle_doc_updated_at
  BEFORE UPDATE ON public.controle_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_controle_doc_cat_updated_at
  BEFORE UPDATE ON public.controle_doc_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_controle_doc_rec_updated_at
  BEFORE UPDATE ON public.controle_doc_recorrentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger histórico AFTER UPDATE
CREATE OR REPLACE FUNCTION public.controle_doc_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.controle_doc_historico(documento_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_email)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, v_user, v_email);
  END IF;
  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    INSERT INTO public.controle_doc_historico(documento_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_email)
    VALUES (NEW.id, 'responsavel_id', OLD.responsavel_id::text, NEW.responsavel_id::text, v_user, v_email);
  END IF;
  IF OLD.prazo IS DISTINCT FROM NEW.prazo THEN
    INSERT INTO public.controle_doc_historico(documento_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_email)
    VALUES (NEW.id, 'prazo', OLD.prazo::text, NEW.prazo::text, v_user, v_email);
  END IF;
  IF OLD.criticidade IS DISTINCT FROM NEW.criticidade THEN
    INSERT INTO public.controle_doc_historico(documento_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_email)
    VALUES (NEW.id, 'criticidade', OLD.criticidade, NEW.criticidade, v_user, v_email);
  END IF;
  IF OLD.tratativa IS DISTINCT FROM NEW.tratativa THEN
    INSERT INTO public.controle_doc_historico(documento_id, campo, valor_anterior, valor_novo, alterado_por, alterado_por_email)
    VALUES (NEW.id, 'tratativa', left(COALESCE(OLD.tratativa,''),200), left(COALESCE(NEW.tratativa,''),200), v_user, v_email);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_controle_doc_log
  AFTER UPDATE ON public.controle_documentos
  FOR EACH ROW EXECUTE FUNCTION public.controle_doc_log_changes();

-- =============================================
-- RLS
-- =============================================

ALTER TABLE public.controle_doc_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_doc_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_doc_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_doc_historico ENABLE ROW LEVEL SECURITY;

-- Categorias
CREATE POLICY cdc_select ON public.controle_doc_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY cdc_insert ON public.controle_doc_categorias FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cdc_update ON public.controle_doc_categorias FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cdc_delete ON public.controle_doc_categorias FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Recorrentes
CREATE POLICY cdr_select ON public.controle_doc_recorrentes FOR SELECT TO authenticated USING (true);
CREATE POLICY cdr_insert ON public.controle_doc_recorrentes FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cdr_update ON public.controle_doc_recorrentes FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cdr_delete ON public.controle_doc_recorrentes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Documentos
CREATE POLICY cd_select ON public.controle_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY cd_insert ON public.controle_documentos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cd_update ON public.controle_documentos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cd_delete ON public.controle_documentos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Anexos
CREATE POLICY cda_select ON public.controle_doc_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY cda_insert ON public.controle_doc_anexos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cda_update ON public.controle_doc_anexos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cda_delete ON public.controle_doc_anexos FOR DELETE TO authenticated USING (is_editor(auth.uid()));

-- Histórico (somente leitura)
CREATE POLICY cdh_select ON public.controle_doc_historico FOR SELECT TO authenticated USING (true);

-- =============================================
-- Storage bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('controle-documentos', 'controle-documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "controle-doc-select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'controle-documentos');

CREATE POLICY "controle-doc-insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'controle-documentos' AND is_editor(auth.uid()));

CREATE POLICY "controle-doc-update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'controle-documentos' AND is_editor(auth.uid()));

CREATE POLICY "controle-doc-delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'controle-documentos' AND has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Seeds
-- =============================================
INSERT INTO public.controle_doc_categorias (codigo, nome, criticidade_sugerida) VALUES
  ('DOCUMENTO_LEGAL', 'Documento Legal', 'CRITICA'),
  ('LICENCA', 'Licença', 'CRITICA'),
  ('CERTIFICADO', 'Certificado', 'ALTA'),
  ('RELATORIO', 'Relatório', 'MEDIA'),
  ('FORMULARIO', 'Formulário', 'BAIXA'),
  ('AUDITORIA', 'Auditoria / Fiscalização', 'CRITICA'),
  ('CONTRATO', 'Contrato', 'ALTA'),
  ('OUTRO', 'Outro', 'MEDIA')
ON CONFLICT (codigo) DO NOTHING;
