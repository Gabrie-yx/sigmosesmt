
-- =========== Não Conformidades (NCs) ===========
CREATE TABLE IF NOT EXISTS public.nao_conformidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  numero TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  origem TEXT, -- 'AUDITORIA', 'INSPECAO', 'INCIDENTE', 'CLIENTE', 'OUTRO'
  severidade TEXT NOT NULL DEFAULT 'MEDIA', -- 'BAIXA','MEDIA','ALTA','CRITICA'
  status TEXT NOT NULL DEFAULT 'ABERTA', -- 'ABERTA','EM_ANALISE','EM_TRATAMENTO','CONCLUIDA','CANCELADA'
  data_identificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_limite DATE,
  data_conclusao DATE,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  causa_raiz TEXT,
  acao_imediata TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========== Incidentes ===========
CREATE TABLE IF NOT EXISTS public.incidentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  numero TEXT,
  tipo TEXT NOT NULL DEFAULT 'QUASE_ACIDENTE', -- 'QUASE_ACIDENTE','INCIDENTE','ACIDENTE_SEM_AFASTAMENTO','ACIDENTE_COM_AFASTAMENTO','DOENCA_OCUPACIONAL'
  gravidade TEXT NOT NULL DEFAULT 'LEVE', -- 'LEVE','MODERADA','GRAVE','FATAL'
  data_ocorrencia TIMESTAMPTZ NOT NULL DEFAULT now(),
  local TEXT,
  descricao TEXT NOT NULL,
  envolvidos JSONB DEFAULT '[]'::jsonb, -- [{employee_id, nome}]
  testemunhas JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'REGISTRADO', -- 'REGISTRADO','EM_INVESTIGACAO','INVESTIGADO','CONCLUIDO'
  causa_raiz TEXT,
  acoes_corretivas TEXT,
  investigador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_investigacao DATE,
  cat_emitida BOOLEAN DEFAULT false,
  cat_numero TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========== Plano de Ações (5W2H) ===========
CREATE TABLE IF NOT EXISTS public.plano_acoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  nc_id UUID REFERENCES public.nao_conformidades(id) ON DELETE SET NULL,
  incidente_id UUID REFERENCES public.incidentes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,                  -- O QUÊ (What)
  descricao TEXT,                        -- POR QUÊ (Why)
  como TEXT,                             -- COMO (How)
  onde TEXT,                             -- ONDE (Where)
  quando DATE,                           -- QUANDO (When) — prazo
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- QUEM (Who)
  custo NUMERIC(12,2),                   -- QUANTO (How much)
  prioridade TEXT NOT NULL DEFAULT 'MEDIA', -- 'BAIXA','MEDIA','ALTA','CRITICA'
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA','ATRASADA'
  data_conclusao DATE,
  evidencias JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nc_status ON public.nao_conformidades(status);
CREATE INDEX IF NOT EXISTS idx_nc_company ON public.nao_conformidades(company_id);
CREATE INDEX IF NOT EXISTS idx_incidentes_status ON public.incidentes(status);
CREATE INDEX IF NOT EXISTS idx_incidentes_data ON public.incidentes(data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_acoes_status ON public.plano_acoes(status);
CREATE INDEX IF NOT EXISTS idx_acoes_quando ON public.plano_acoes(quando);
CREATE INDEX IF NOT EXISTS idx_acoes_nc ON public.plano_acoes(nc_id);
CREATE INDEX IF NOT EXISTS idx_acoes_incidente ON public.plano_acoes(incidente_id);

-- Triggers de updated_at
DROP TRIGGER IF EXISTS trg_nc_updated_at ON public.nao_conformidades;
CREATE TRIGGER trg_nc_updated_at BEFORE UPDATE ON public.nao_conformidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_incidentes_updated_at ON public.incidentes;
CREATE TRIGGER trg_incidentes_updated_at BEFORE UPDATE ON public.incidentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_acoes_updated_at ON public.plano_acoes;
CREATE TRIGGER trg_acoes_updated_at BEFORE UPDATE ON public.plano_acoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_acoes ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer usuário autenticado pode CRUD (mesmo padrão das demais tabelas SESMT do projeto)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['nao_conformidades','incidentes','plano_acoes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_select_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth_select_%s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%s" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON public.%I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;
