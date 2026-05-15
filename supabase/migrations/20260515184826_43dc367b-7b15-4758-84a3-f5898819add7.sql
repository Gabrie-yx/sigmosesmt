
-- =========================
-- PROCEDIMENTOS / POPs
-- =========================

CREATE TABLE public.procedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  objetivo TEXT,
  escopo TEXT NOT NULL DEFAULT 'AMBOS', -- CLT | TERCEIRO | AMBOS
  area TEXT NOT NULL DEFAULT 'SST',     -- SST | QUALIDADE | PRODUCAO | RH | OUTRO
  criticidade TEXT NOT NULL DEFAULT 'MEDIA', -- ALTA | MEDIA | BAIXA
  status TEXT NOT NULL DEFAULT 'RASCUNHO',   -- RASCUNHO | HOMOLOGADO | OBSOLETO
  versao_atual TEXT NOT NULL DEFAULT '01',
  periodicidade_revisao_meses INTEGER NOT NULL DEFAULT 24,
  proxima_revisao DATE,
  responsavel TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT procedimentos_escopo_chk CHECK (escopo IN ('CLT','TERCEIRO','AMBOS')),
  CONSTRAINT procedimentos_status_chk CHECK (status IN ('RASCUNHO','HOMOLOGADO','OBSOLETO')),
  CONSTRAINT procedimentos_critic_chk CHECK (criticidade IN ('ALTA','MEDIA','BAIXA'))
);

CREATE INDEX idx_procedimentos_status ON public.procedimentos(status);
CREATE INDEX idx_procedimentos_escopo ON public.procedimentos(escopo);

ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY procedimentos_select ON public.procedimentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY procedimentos_insert ON public.procedimentos
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY procedimentos_update ON public.procedimentos
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY procedimentos_delete ON public.procedimentos
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_procedimentos_updated
  BEFORE UPDATE ON public.procedimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- REVISÕES
-- =========================
CREATE TABLE public.procedimento_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos(id) ON DELETE CASCADE,
  versao TEXT NOT NULL,
  pdf_path TEXT,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_homologacao DATE,
  motivo_revisao TEXT,
  responsavel TEXT,
  homologado_por UUID,
  status TEXT NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | HOMOLOGADO | SUPERADA
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (procedimento_id, versao),
  CONSTRAINT proc_rev_status_chk CHECK (status IN ('RASCUNHO','HOMOLOGADO','SUPERADA'))
);

CREATE INDEX idx_proc_rev_proc ON public.procedimento_revisoes(procedimento_id);

ALTER TABLE public.procedimento_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_rev_select ON public.procedimento_revisoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY proc_rev_insert ON public.procedimento_revisoes
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY proc_rev_update ON public.procedimento_revisoes
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY proc_rev_delete ON public.procedimento_revisoes
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_proc_rev_updated
  BEFORE UPDATE ON public.procedimento_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- CIÊNCIAS
-- =========================
CREATE TABLE public.procedimento_cientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedimento_id UUID NOT NULL REFERENCES public.procedimentos(id) ON DELETE CASCADE,
  revisao_id UUID REFERENCES public.procedimento_revisoes(id) ON DELETE SET NULL,
  versao TEXT NOT NULL,
  employee_id UUID NOT NULL,
  origem TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL | DDS | INTEGRACAO
  dds_id UUID,
  evidencia_path TEXT,
  data_ciencia DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (procedimento_id, versao, employee_id),
  CONSTRAINT proc_ciente_origem_chk CHECK (origem IN ('MANUAL','DDS','INTEGRACAO'))
);

CREATE INDEX idx_proc_ciente_proc ON public.procedimento_cientes(procedimento_id);
CREATE INDEX idx_proc_ciente_emp ON public.procedimento_cientes(employee_id);

ALTER TABLE public.procedimento_cientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_ciente_select ON public.procedimento_cientes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY proc_ciente_insert ON public.procedimento_cientes
  FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY proc_ciente_update ON public.procedimento_cientes
  FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY proc_ciente_delete ON public.procedimento_cientes
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================
-- BUCKET DE STORAGE
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('procedimentos-pdfs', 'procedimentos-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "procedimentos pdfs select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'procedimentos-pdfs');

CREATE POLICY "procedimentos pdfs insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procedimentos-pdfs' AND is_editor(auth.uid()));

CREATE POLICY "procedimentos pdfs update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'procedimentos-pdfs' AND is_editor(auth.uid()));

CREATE POLICY "procedimentos pdfs delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'procedimentos-pdfs' AND has_role(auth.uid(), 'admin'::app_role));
