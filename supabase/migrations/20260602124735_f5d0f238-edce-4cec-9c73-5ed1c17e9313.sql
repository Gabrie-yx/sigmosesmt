
-- ============================================================
-- FASE 1 PGR — GHE + Inventário AIHA 5x5 + Plano de Ação + Flag PT/APR
-- ============================================================

-- 1) GHE (Grupo Homogêneo de Exposição)
CREATE TABLE public.pgr_ghe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL,
  setor TEXT NOT NULL,
  descricao_ambiente TEXT,
  qtd_colaboradores INT DEFAULT 0,
  jornada TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_ghe TO authenticated;
GRANT ALL ON public.pgr_ghe TO service_role;

ALTER TABLE public.pgr_ghe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GHE: leitura autenticada" ON public.pgr_ghe
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "GHE: editores podem inserir" ON public.pgr_ghe
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "GHE: editores podem atualizar" ON public.pgr_ghe
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));

CREATE POLICY "GHE: admin pode excluir" ON public.pgr_ghe
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_pgr_ghe_updated_at
  BEFORE UPDATE ON public.pgr_ghe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Liga roles (cargos) ao GHE — coluna opcional
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_roles_ghe_id ON public.roles(ghe_id);

-- 3) Inventário de Riscos por GHE (AIHA 5x5)
CREATE TABLE public.pgr_inventario_riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghe_id UUID NOT NULL REFERENCES public.pgr_ghe(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('FISICO','QUIMICO','BIOLOGICO','ERGONOMICO','ACIDENTE')),
  perigo TEXT NOT NULL,
  agravo TEXT,
  fonte_geradora TEXT,
  controles_existentes TEXT,
  exposicao TEXT,
  intensidade NUMERIC,
  unidade TEXT,
  limite_tolerancia NUMERIC,
  tipo_avaliacao TEXT,
  probabilidade INT CHECK (probabilidade BETWEEN 1 AND 5),
  severidade INT CHECK (severidade BETWEEN 1 AND 5),
  risco INT GENERATED ALWAYS AS (COALESCE(probabilidade,0) * COALESCE(severidade,0)) STORED,
  classificacao TEXT,
  monitoramento TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_pgr_inv_ghe ON public.pgr_inventario_riscos(ghe_id);
CREATE INDEX idx_pgr_inv_classif ON public.pgr_inventario_riscos(classificacao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_inventario_riscos TO authenticated;
GRANT ALL ON public.pgr_inventario_riscos TO service_role;

ALTER TABLE public.pgr_inventario_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inv: leitura autenticada" ON public.pgr_inventario_riscos
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "Inv: editores podem inserir" ON public.pgr_inventario_riscos
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Inv: editores podem atualizar" ON public.pgr_inventario_riscos
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "Inv: admin pode excluir" ON public.pgr_inventario_riscos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_pgr_inv_updated_at
  BEFORE UPDATE ON public.pgr_inventario_riscos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Plano de Ação 5W2H ligado ao inventário
CREATE TABLE public.pgr_plano_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES public.pgr_inventario_riscos(id) ON DELETE CASCADE,
  o_que TEXT NOT NULL,
  por_que TEXT,
  onde TEXT,
  quem TEXT,
  quando DATE,
  como TEXT,
  quanto NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
  data_conclusao DATE,
  evidencia_url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_pgr_plano_inv ON public.pgr_plano_acao(inventario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pgr_plano_acao TO authenticated;
GRANT ALL ON public.pgr_plano_acao TO service_role;

ALTER TABLE public.pgr_plano_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plano: leitura autenticada" ON public.pgr_plano_acao
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "Plano: editores podem inserir" ON public.pgr_plano_acao
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "Plano: editores podem atualizar" ON public.pgr_plano_acao
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "Plano: admin pode excluir" ON public.pgr_plano_acao
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_pgr_plano_updated_at
  BEFORE UPDATE ON public.pgr_plano_acao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Flag PT exige APR válida (em company_settings se existir, senão cria tabela mínima)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_settings') THEN
    EXECUTE 'ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS pt_exige_apr_valida BOOLEAN NOT NULL DEFAULT false';
  ELSE
    CREATE TABLE public.company_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pt_exige_apr_valida BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    GRANT SELECT ON public.company_settings TO authenticated;
    GRANT ALL ON public.company_settings TO service_role;
    ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Settings: leitura autenticada" ON public.company_settings
      FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
    CREATE POLICY "Settings: admin gerencia" ON public.company_settings
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    INSERT INTO public.company_settings (pt_exige_apr_valida) VALUES (false);
  END IF;
END $$;
