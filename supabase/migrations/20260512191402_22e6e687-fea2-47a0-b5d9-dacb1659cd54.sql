
-- ============= APRs (cabeçalho) =============
CREATE TABLE public.aprs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  casco_id UUID REFERENCES public.cascos(id) ON DELETE SET NULL,
  pte_id UUID REFERENCES public.ptes(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  encarregado_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  tst_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  local TEXT,
  setor TEXT,
  atividade_descricao TEXT NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIME,
  hora_fim TIME,
  validade_dias INTEGER NOT NULL DEFAULT 7,
  data_validade DATE,
  condicoes_climaticas TEXT,
  observacoes_gerais TEXT,
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','ATIVA','ENCERRADA','CANCELADA')),
  exige_pte BOOLEAN NOT NULL DEFAULT false,
  pdf_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aprs_casco ON public.aprs(casco_id);
CREATE INDEX idx_aprs_pte ON public.aprs(pte_id);
CREATE INDEX idx_aprs_status ON public.aprs(status);
CREATE INDEX idx_aprs_data ON public.aprs(data_emissao DESC);

ALTER TABLE public.aprs ENABLE ROW LEVEL SECURITY;
CREATE POLICY aprs_select ON public.aprs FOR SELECT TO authenticated USING (true);
CREATE POLICY aprs_insert ON public.aprs FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY aprs_update ON public.aprs FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY aprs_delete ON public.aprs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_aprs_updated_at BEFORE UPDATE ON public.aprs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= Linhas da matriz de risco =============
CREATE TABLE public.apr_riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apr_id UUID NOT NULL REFERENCES public.aprs(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  catalogo_risco_id UUID REFERENCES public.catalogo_riscos(id) ON DELETE SET NULL,
  risco_nome TEXT NOT NULL,
  risco_categoria TEXT,
  efeitos_danos TEXT,
  probabilidade INTEGER NOT NULL DEFAULT 1 CHECK (probabilidade BETWEEN 1 AND 5),
  severidade INTEGER NOT NULL DEFAULT 1 CHECK (severidade BETWEEN 1 AND 5),
  nivel_risco INTEGER GENERATED ALWAYS AS (probabilidade * severidade) STORED,
  acoes_preventivas TEXT,
  epis TEXT[] NOT NULL DEFAULT '{}',
  nrs TEXT[] NOT NULL DEFAULT '{}',
  responsavel_acoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apr_riscos_apr ON public.apr_riscos(apr_id);

ALTER TABLE public.apr_riscos ENABLE ROW LEVEL SECURITY;
CREATE POLICY apr_riscos_select ON public.apr_riscos FOR SELECT TO authenticated USING (true);
CREATE POLICY apr_riscos_insert ON public.apr_riscos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY apr_riscos_update ON public.apr_riscos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY apr_riscos_delete ON public.apr_riscos FOR DELETE TO authenticated USING (is_editor(auth.uid()));

-- ============= Assinaturas =============
CREATE TABLE public.apr_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apr_id UUID NOT NULL REFERENCES public.aprs(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('EXECUTANTE','TST','ENCARREGADO')),
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  funcao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  assinou_em TIMESTAMPTZ,
  assinatura_imagem_path TEXT,
  confirmado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apr_assinaturas_apr ON public.apr_assinaturas(apr_id);

ALTER TABLE public.apr_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY apr_assin_select ON public.apr_assinaturas FOR SELECT TO authenticated USING (true);
CREATE POLICY apr_assin_insert ON public.apr_assinaturas FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY apr_assin_update ON public.apr_assinaturas FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY apr_assin_delete ON public.apr_assinaturas FOR DELETE TO authenticated USING (is_editor(auth.uid()));

-- ============= Função: gerar próximo número da APR =============
CREATE OR REPLACE FUNCTION public.gerar_numero_apr()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INT := EXTRACT(YEAR FROM CURRENT_DATE);
  v_mes INT := EXTRACT(MONTH FROM CURRENT_DATE);
  v_prefix TEXT := 'APR-' || v_ano::TEXT || '-' || LPAD(v_mes::TEXT, 2, '0') || '-';
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(numero FROM '\d+$')::INT), 0) + 1
    INTO v_seq
    FROM public.aprs
   WHERE numero LIKE v_prefix || '%';
  RETURN v_prefix || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ============= Trigger: calcula data_validade automaticamente =============
CREATE OR REPLACE FUNCTION public.calc_apr_validade()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_validade IS NULL OR (TG_OP = 'UPDATE' AND (OLD.data_emissao <> NEW.data_emissao OR OLD.validade_dias <> NEW.validade_dias)) THEN
    NEW.data_validade := NEW.data_emissao + (NEW.validade_dias || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aprs_validade
  BEFORE INSERT OR UPDATE ON public.aprs
  FOR EACH ROW EXECUTE FUNCTION public.calc_apr_validade();
