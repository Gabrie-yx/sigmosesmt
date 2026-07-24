-- Módulo CIPA (NR-05 rev. Portaria MTP 4.219/2022 + Lei 14.457/2022)

CREATE TABLE public.cipa_gestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  gestao TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  cnae TEXT,
  grupo_nr05 TEXT,
  num_empregados INTEGER,
  efetivos_empregador INTEGER DEFAULT 0,
  suplentes_empregador INTEGER DEFAULT 0,
  efetivos_empregados INTEGER DEFAULT 0,
  suplentes_empregados INTEGER DEFAULT 0,
  presidente_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  vice_presidente_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  secretario_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PLANEJAMENTO'
    CHECK (status IN ('PLANEJAMENTO','ELEICAO','ATIVA','ENCERRADA')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_cipa_gestoes_company_status ON public.cipa_gestoes(company_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cipa_gestoes TO authenticated;
GRANT ALL ON public.cipa_gestoes TO service_role;
ALTER TABLE public.cipa_gestoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cipa_gestoes_read" ON public.cipa_gestoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cipa_gestoes_write" ON public.cipa_gestoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE TRIGGER trg_cipa_gestoes_updated_at BEFORE UPDATE ON public.cipa_gestoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE public.cipa_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestao_id UUID NOT NULL REFERENCES public.cipa_gestoes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  representacao TEXT NOT NULL CHECK (representacao IN ('EMPREGADOR','EMPREGADOS')),
  papel TEXT NOT NULL CHECK (papel IN ('EFETIVO','SUPLENTE')),
  votos INTEGER,
  posse_em DATE,
  status TEXT NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('ATIVO','AFASTADO','DESLIGADO')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gestao_id, employee_id)
);
CREATE INDEX idx_cipa_membros_gestao ON public.cipa_membros(gestao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cipa_membros TO authenticated;
GRANT ALL ON public.cipa_membros TO service_role;
ALTER TABLE public.cipa_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cipa_membros_read" ON public.cipa_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "cipa_membros_write" ON public.cipa_membros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE TRIGGER trg_cipa_membros_updated_at BEFORE UPDATE ON public.cipa_membros
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE public.cipa_reunioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestao_id UUID NOT NULL REFERENCES public.cipa_gestoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'ORDINARIA'
    CHECK (tipo IN ('ORDINARIA','EXTRAORDINARIA','POSSE','ENCERRAMENTO')),
  data DATE NOT NULL,
  hora TIME,
  local TEXT,
  pauta TEXT,
  ata_texto TEXT,
  ata_url TEXT,
  presentes JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'AGENDADA'
    CHECK (status IN ('AGENDADA','REALIZADA','CANCELADA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_cipa_reunioes_gestao_data ON public.cipa_reunioes(gestao_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cipa_reunioes TO authenticated;
GRANT ALL ON public.cipa_reunioes TO service_role;
ALTER TABLE public.cipa_reunioes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cipa_reunioes_read" ON public.cipa_reunioes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cipa_reunioes_write" ON public.cipa_reunioes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE TRIGGER trg_cipa_reunioes_updated_at BEFORE UPDATE ON public.cipa_reunioes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE public.cipa_plano_anual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestao_id UUID NOT NULL REFERENCES public.cipa_gestoes(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  eixo TEXT NOT NULL DEFAULT 'PREVENCAO'
    CHECK (eixo IN ('PREVENCAO','ASSEDIO','INSPECAO','TREINAMENTO','COMUNICACAO','OUTRO')),
  acao TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  prazo DATE,
  base_normativa TEXT,
  status TEXT NOT NULL DEFAULT 'PLANEJADA'
    CHECK (status IN ('PLANEJADA','EM_ANDAMENTO','CONCLUIDA','ATRASADA','CANCELADA')),
  evidencia_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cipa_plano_gestao ON public.cipa_plano_anual(gestao_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cipa_plano_anual TO authenticated;
GRANT ALL ON public.cipa_plano_anual TO service_role;
ALTER TABLE public.cipa_plano_anual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cipa_plano_read" ON public.cipa_plano_anual FOR SELECT TO authenticated USING (true);
CREATE POLICY "cipa_plano_write" ON public.cipa_plano_anual FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE TRIGGER trg_cipa_plano_updated_at BEFORE UPDATE ON public.cipa_plano_anual
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE public.cipa_calendario_eleicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestao_id UUID NOT NULL REFERENCES public.cipa_gestoes(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN (
    'CONSTITUICAO_COMISSAO_ELEITORAL',
    'PUBLICACAO_EDITAL',
    'INSCRICAO_CANDIDATOS',
    'CAMPANHA',
    'VOTACAO',
    'APURACAO',
    'HOMOLOGACAO',
    'POSSE'
  )),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'PLANEJADA'
    CHECK (status IN ('PLANEJADA','EM_ANDAMENTO','CONCLUIDA','ATRASADA')),
  responsavel TEXT,
  documento_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gestao_id, etapa)
);
CREATE INDEX idx_cipa_calendario_gestao ON public.cipa_calendario_eleicao(gestao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cipa_calendario_eleicao TO authenticated;
GRANT ALL ON public.cipa_calendario_eleicao TO service_role;
ALTER TABLE public.cipa_calendario_eleicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cipa_calendario_read" ON public.cipa_calendario_eleicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "cipa_calendario_write" ON public.cipa_calendario_eleicao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE TRIGGER trg_cipa_calendario_updated_at BEFORE UPDATE ON public.cipa_calendario_eleicao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();