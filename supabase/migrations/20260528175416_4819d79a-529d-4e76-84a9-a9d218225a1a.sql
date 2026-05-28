-- ============================================================
-- 1) TABELA: cargo_riscos (vínculo cargo ↔ risco com intensidade)
-- ============================================================
CREATE TABLE public.cargo_riscos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  risco_id UUID NOT NULL REFERENCES public.catalogo_riscos(id) ON DELETE RESTRICT,
  intensidade NUMERIC(10,3),
  unidade TEXT,
  limite_tolerancia NUMERIC(10,3),
  limite_referencia TEXT,
  tecnica_medicao TEXT,
  fonte_geradora TEXT,
  trajetoria TEXT,
  tempo_exposicao_min INT,
  epi_atenuacao_db NUMERIC(6,2),
  epi_atenuacao_pct NUMERIC(5,2),
  meios_controle TEXT,
  status_avaliacao TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status_avaliacao IN ('AVALIADO','PENDENTE','NAO_APLICAVEL','EM_REVISAO')),
  insalubridade_grau TEXT
    CHECK (insalubridade_grau IS NULL OR insalubridade_grau IN ('MINIMO','MEDIO','MAXIMO','NAO_INSALUBRE')),
  periculosidade BOOLEAN NOT NULL DEFAULT false,
  aposentadoria_especial_anos INT
    CHECK (aposentadoria_especial_anos IS NULL OR aposentadoria_especial_anos IN (15,20,25)),
  data_avaliacao DATE,
  proxima_avaliacao DATE,
  responsavel_avaliacao TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (role_id, risco_id)
);

CREATE INDEX idx_cargo_riscos_role ON public.cargo_riscos(role_id);
CREATE INDEX idx_cargo_riscos_risco ON public.cargo_riscos(risco_id);
CREATE INDEX idx_cargo_riscos_status ON public.cargo_riscos(status_avaliacao) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargo_riscos TO authenticated;
GRANT ALL ON public.cargo_riscos TO service_role;

ALTER TABLE public.cargo_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargo_riscos visíveis para autenticados"
  ON public.cargo_riscos FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "cargo_riscos insert por editor+"
  ON public.cargo_riscos FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "cargo_riscos update por editor+"
  ON public.cargo_riscos FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "cargo_riscos delete por moderador+"
  ON public.cargo_riscos FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

CREATE TRIGGER trg_cargo_riscos_updated
  BEFORE UPDATE ON public.cargo_riscos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) TABELA: cargo_riscos_medicoes (histórico p/ auditoria)
-- ============================================================
CREATE TABLE public.cargo_riscos_medicoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cargo_risco_id UUID NOT NULL REFERENCES public.cargo_riscos(id) ON DELETE CASCADE,
  data_medicao DATE NOT NULL,
  valor_medido NUMERIC(10,3) NOT NULL,
  unidade TEXT NOT NULL,
  tecnica TEXT,
  equipamento TEXT,
  responsavel_tecnico TEXT,
  art_numero TEXT,
  anexo_path TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_cr_medicoes_cargo_risco ON public.cargo_riscos_medicoes(cargo_risco_id);
CREATE INDEX idx_cr_medicoes_data ON public.cargo_riscos_medicoes(data_medicao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargo_riscos_medicoes TO authenticated;
GRANT ALL ON public.cargo_riscos_medicoes TO service_role;

ALTER TABLE public.cargo_riscos_medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes visíveis para autenticados"
  ON public.cargo_riscos_medicoes FOR SELECT TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "medicoes insert por editor+"
  ON public.cargo_riscos_medicoes FOR INSERT TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "medicoes update por editor+"
  ON public.cargo_riscos_medicoes FOR UPDATE TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "medicoes delete por moderador+"
  ON public.cargo_riscos_medicoes FOR DELETE TO authenticated
  USING (public.is_moderator(auth.uid()));

-- ============================================================
-- 3) Catálogo: completar riscos faltantes do PGR
-- ============================================================
INSERT INTO public.catalogo_riscos (categoria, nome, efeitos_tipicos, medidas_controle_padrao, nrs_aplicaveis, epis_sugeridos, ativo)
VALUES
  ('FISICO', 'Calor (IBUTG)',
    ARRAY['Estresse térmico','Desidratação','Câimbra de calor','Exaustão'],
    ARRAY['Rodízio de tarefas','Pausas em ambiente climatizado','Hidratação','Sombreamento de área'],
    ARRAY['NR-15 Anexo 3','NR-09','NHO-06'],
    ARRAY['Uniforme leve','Boné árabe','Protetor solar'],
    true),
  ('FISICO', 'Vibração de corpo inteiro',
    ARRAY['Lombalgia','Hérnia de disco','Distúrbios circulatórios'],
    ARRAY['Manutenção de assentos','Limitação de tempo de exposição','Treinamento'],
    ARRAY['NR-09','NR-15 Anexo 8','NHO-09'],
    ARRAY['Assento com amortecimento'],
    true),
  ('FISICO', 'Radiação não-ionizante (UV de solda)',
    ARRAY['Queimadura de córnea','Fotoceratite','Queimadura de pele','Catarata'],
    ARRAY['Cabines de solda','Cortinas opacas','Isolamento de área'],
    ARRAY['NR-06','NR-15 Anexo 7','NR-34'],
    ARRAY['Máscara de solda automática','Avental de raspa','Luva de raspa','Mangote'],
    true),
  ('QUIMICO', 'Fumos metálicos de soldagem',
    ARRAY['Febre dos fumos metálicos','Pneumoconiose','Bronquite','Câncer pulmonar'],
    ARRAY['Exaustão local','Ventilação geral','Substituição de eletrodo'],
    ARRAY['NR-09','NR-15 Anexo 11','NR-34'],
    ARRAY['Respirador PFF2','Respirador com filtro químico','Máscara facial inteira'],
    true),
  ('QUIMICO', 'Material particulado de esmerilhamento',
    ARRAY['Silicose','Irritação ocular','Dermatite','Doença pulmonar'],
    ARRAY['Aspiração na fonte','Ventilação','Umidificação'],
    ARRAY['NR-09','NR-15 Anexo 12'],
    ARRAY['Respirador PFF2','Óculos ampla visão','Protetor facial'],
    true),
  ('ERGONOMICO', 'Postura forçada',
    ARRAY['LER/DORT','Lombalgia','Cervicalgia','Tendinite'],
    ARRAY['Pausas','Rodízio','Análise ergonômica do trabalho'],
    ARRAY['NR-17'],
    ARRAY[]::text[],
    true)
ON CONFLICT DO NOTHING;