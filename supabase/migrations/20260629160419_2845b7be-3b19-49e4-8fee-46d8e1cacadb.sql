
-- 1. Catálogo de documentos da contratada
CREATE TABLE public.contratada_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL, -- PGR, PCMSO, CND_FEDERAL, CND_TRABALHISTA, CND_FGTS, ART_PGR, ART_PCMSO, ALVARA, SEGURO_VIDA, CONTRATO_SOCIAL, CARTAO_CNPJ, OUTROS
  numero TEXT,
  data_emissao DATE,
  data_validade DATE,
  arquivo_path TEXT,
  arquivo_nome TEXT,
  responsavel_envio TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratada_documentos TO authenticated;
GRANT ALL ON public.contratada_documentos TO service_role;

ALTER TABLE public.contratada_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contratada_documentos"
  ON public.contratada_documentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert contratada_documentos"
  ON public.contratada_documentos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
    OR public.has_role(auth.uid(), 'tst')
    OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Editors can update contratada_documentos"
  ON public.contratada_documentos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
    OR public.has_role(auth.uid(), 'tst')
    OR public.has_role(auth.uid(), 'editor')
  );

CREATE POLICY "Admin can delete contratada_documentos"
  ON public.contratada_documentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador'));

-- 2. Função de aprovação de acordos (admin / tst / moderador)
CREATE OR REPLACE FUNCTION public.can_approve_acordo(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'moderador')
    OR public.has_role(_user_id, 'tst');
$$;

-- 3. Acordos de Adequação
CREATE TABLE public.contratada_acordos_adequacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.contratada_documentos(id) ON DELETE SET NULL,
  tipo_documento TEXT NOT NULL, -- mesmo enum de contratada_documentos.tipo_documento
  justificativa TEXT NOT NULL,
  plano_acao TEXT NOT NULL,
  data_aprovacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_limite DATE NOT NULL,
  aprovador_id UUID NOT NULL,
  aprovador_nome TEXT NOT NULL,
  aprovador_cargo TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO', -- ATIVO, EXPIRADO, CUMPRIDO, CANCELADO
  data_cumprimento DATE,
  motivo_cancelamento TEXT,
  num_prorrogacoes INTEGER NOT NULL DEFAULT 0,
  arquivo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prazo_max_90d CHECK (data_limite <= data_aprovacao + INTERVAL '90 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratada_acordos_adequacao TO authenticated;
GRANT ALL ON public.contratada_acordos_adequacao TO service_role;

ALTER TABLE public.contratada_acordos_adequacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read acordos"
  ON public.contratada_acordos_adequacao FOR SELECT TO authenticated USING (true);

CREATE POLICY "Aprovadores can insert acordos"
  ON public.contratada_acordos_adequacao FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_acordo(auth.uid()) AND aprovador_id = auth.uid());

CREATE POLICY "Aprovadores can update acordos"
  ON public.contratada_acordos_adequacao FOR UPDATE TO authenticated
  USING (public.can_approve_acordo(auth.uid()));

CREATE POLICY "Admin can delete acordos"
  ON public.contratada_acordos_adequacao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Histórico de prorrogações
CREATE TABLE public.contratada_acordos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id UUID NOT NULL REFERENCES public.contratada_acordos_adequacao(id) ON DELETE CASCADE,
  acao TEXT NOT NULL, -- CRIADO, PRORROGADO, CUMPRIDO, CANCELADO, EXPIRADO
  data_limite_anterior DATE,
  data_limite_nova DATE,
  justificativa TEXT NOT NULL,
  responsavel_id UUID NOT NULL,
  responsavel_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contratada_acordos_historico TO authenticated;
GRANT ALL ON public.contratada_acordos_historico TO service_role;

ALTER TABLE public.contratada_acordos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read historico"
  ON public.contratada_acordos_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Aprovadores can insert historico"
  ON public.contratada_acordos_historico FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_acordo(auth.uid()) AND responsavel_id = auth.uid());

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_contratada_documentos_updated
  BEFORE UPDATE ON public.contratada_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_contratada_acordos_updated
  BEFORE UPDATE ON public.contratada_acordos_adequacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Trigger: registra criação automaticamente no histórico
CREATE OR REPLACE FUNCTION public.tg_acordo_log_criacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.contratada_acordos_historico
    (acordo_id, acao, data_limite_nova, justificativa, responsavel_id, responsavel_nome)
  VALUES
    (NEW.id, 'CRIADO', NEW.data_limite, NEW.justificativa, NEW.aprovador_id, NEW.aprovador_nome);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_acordo_log_criacao
  AFTER INSERT ON public.contratada_acordos_adequacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_acordo_log_criacao();

-- 7. View: status consolidado por empresa
CREATE OR REPLACE VIEW public.v_contratada_dossie_status AS
SELECT
  c.id AS company_id,
  c.name AS empresa,
  c.cnpj,
  c.type AS tipo_empresa,
  COUNT(d.id) FILTER (WHERE d.data_validade >= CURRENT_DATE) AS docs_vigentes,
  COUNT(d.id) FILTER (WHERE d.data_validade < CURRENT_DATE) AS docs_vencidos,
  COUNT(a.id) FILTER (WHERE a.status = 'ATIVO' AND a.data_limite >= CURRENT_DATE) AS acordos_ativos,
  COUNT(a.id) FILTER (WHERE a.status = 'ATIVO' AND a.data_limite < CURRENT_DATE) AS acordos_vencidos,
  CASE
    WHEN COUNT(d.id) FILTER (WHERE d.data_validade < CURRENT_DATE) > 0
         AND COUNT(a.id) FILTER (WHERE a.status = 'ATIVO' AND a.data_limite >= CURRENT_DATE) = 0
    THEN 'IRREGULAR'
    WHEN COUNT(a.id) FILTER (WHERE a.status = 'ATIVO') > 0
    THEN 'EM_ADEQUACAO'
    WHEN COUNT(d.id) FILTER (WHERE d.data_validade >= CURRENT_DATE) > 0
    THEN 'REGULAR'
    ELSE 'SEM_DOCS'
  END AS status_geral
FROM public.companies c
LEFT JOIN public.contratada_documentos d ON d.company_id = c.id
LEFT JOIN public.contratada_acordos_adequacao a ON a.company_id = c.id
GROUP BY c.id, c.name, c.cnpj, c.type;

GRANT SELECT ON public.v_contratada_dossie_status TO authenticated;

-- 8. Job: expira acordos vencidos (rodar via cron ou manual)
CREATE OR REPLACE FUNCTION public.expirar_acordos_vencidos()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.contratada_acordos_adequacao
    SET status = 'EXPIRADO'
    WHERE status = 'ATIVO' AND data_limite < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO n FROM upd;
  RETURN n;
END; $$;

-- 9. Índices
CREATE INDEX idx_contratada_documentos_company ON public.contratada_documentos(company_id);
CREATE INDEX idx_contratada_documentos_validade ON public.contratada_documentos(data_validade);
CREATE INDEX idx_contratada_acordos_company ON public.contratada_acordos_adequacao(company_id);
CREATE INDEX idx_contratada_acordos_status ON public.contratada_acordos_adequacao(status, data_limite);
CREATE INDEX idx_contratada_acordos_historico_acordo ON public.contratada_acordos_historico(acordo_id);
