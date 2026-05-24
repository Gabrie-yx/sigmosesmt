-- Tabela de modelos de APR (templates pré-construídos por tipo de atividade)
CREATE TABLE public.apr_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,                    -- ex: 'corte-esmerilhamento-patio'
  nome text NOT NULL,                             -- nome visível no dropdown
  categoria text NOT NULL,                        -- 'CORTE_SOLDA' | 'ICAMENTO' | 'JATEAMENTO' | 'ALTURA' | 'CESTO_AEREO'
  descricao_curta text,                           -- 1-linha p/ explicar quando usar
  -- Campos que pré-populam a APR
  atividade_descricao text NOT NULL,
  setor_padrao text,
  local_padrao text,
  condicoes_climaticas text,
  observacoes_gerais text,
  exige_pte boolean NOT NULL DEFAULT false,
  ptes_sugeridas text[] NOT NULL DEFAULT '{}',    -- ex: ['Trabalho em Altura', 'Trabalho a Quente']
  -- Riscos empacotados (cada item = 1 linha da matriz P×S)
  -- shape: { risco_nome, risco_categoria, efeitos_danos, probabilidade, severidade,
  --          acoes_preventivas, epis, nrs, responsavel_acoes, passo_a_passo }
  riscos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordem int NOT NULL DEFAULT 0,                   -- ordenação no dropdown
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_apr_modelos_ativo_ordem ON public.apr_modelos (ativo, ordem);

ALTER TABLE public.apr_modelos ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado com acesso ao app
CREATE POLICY "Modelos visíveis para autenticados"
  ON public.apr_modelos FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

-- Escrita: apenas admin (modelos são padrão da empresa, não do usuário)
CREATE POLICY "Apenas admin cria modelos"
  ON public.apr_modelos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Apenas admin altera modelos"
  ON public.apr_modelos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Apenas admin deleta modelos"
  ON public.apr_modelos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at automático
CREATE TRIGGER trg_apr_modelos_updated_at
  BEFORE UPDATE ON public.apr_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();