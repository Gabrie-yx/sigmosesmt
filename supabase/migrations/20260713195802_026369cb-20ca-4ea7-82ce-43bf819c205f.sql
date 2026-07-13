
CREATE TABLE public.inspecao_matriz_rubrica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eixo text NOT NULL CHECK (eixo IN ('P','S')),
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 5),
  rotulo text NOT NULL,
  definicao text NOT NULL,
  exemplo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eixo, nivel)
);

CREATE TABLE public.inspecao_nr28_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gradacao text NOT NULL CHECK (gradacao IN ('I1','I2','I3','I4')),
  grau_risco smallint NOT NULL CHECK (grau_risco BETWEEN 1 AND 4),
  faixa_min_empregados int NOT NULL,
  faixa_max_empregados int,
  valor_reais numeric(12,2) NOT NULL,
  portaria_ref text NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inspecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  frente_servico_id uuid REFERENCES public.company_frentes_servico(id) ON DELETE SET NULL,
  local_descricao text NOT NULL,
  data_inspecao date NOT NULL,
  escopo text,
  tipo_local text,
  participantes text,
  aberta_por uuid NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_revisao','publicada','arquivada')),
  revisada_por uuid,
  publicada_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_inspecoes_empresa ON public.inspecoes(empresa_id);
CREATE INDEX ix_inspecoes_status ON public.inspecoes(status);
CREATE INDEX ix_inspecoes_data ON public.inspecoes(data_inspecao DESC);

CREATE TABLE public.inspecao_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspecao_id uuid NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  fonte text NOT NULL CHECK (fonte IN ('celular','cftv','outro')),
  storage_path text NOT NULL,
  hash_sha256 text NOT NULL,
  timestamp_captura timestamptz,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gps_accuracy numeric(8,2),
  camera_ref text,
  legenda text,
  tirada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inspecao_fotos_inspecao ON public.inspecao_fotos(inspecao_id);

CREATE TABLE public.inspecao_ncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspecao_id uuid NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  foto_id uuid REFERENCES public.inspecao_fotos(id) ON DELETE SET NULL,
  nr_codigo text NOT NULL,
  nr_item text,
  descricao text NOT NULL,
  probabilidade smallint NOT NULL CHECK (probabilidade BETWEEN 1 AND 5),
  severidade smallint NOT NULL CHECK (severidade BETWEEN 1 AND 5),
  risco_calculado smallint GENERATED ALWAYS AS (probabilidade * severidade) STORED,
  classe_risco text GENERATED ALWAYS AS (
    CASE
      WHEN probabilidade * severidade >= 15 THEN 'CRITICO'
      WHEN probabilidade * severidade >= 8 THEN 'ALTO'
      WHEN probabilidade * severidade >= 4 THEN 'MODERADO'
      ELSE 'BAIXO'
    END
  ) STORED,
  gradacao_nr28 text CHECK (gradacao_nr28 IN ('I1','I2','I3','I4')),
  multa_estimada numeric(12,2),
  recomendacao text,
  criada_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inspecao_ncs_inspecao ON public.inspecao_ncs(inspecao_id);
CREATE INDEX ix_inspecao_ncs_nr ON public.inspecao_ncs(nr_codigo);

CREATE TABLE public.inspecao_ncs_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id uuid NOT NULL REFERENCES public.inspecao_ncs(id) ON DELETE CASCADE,
  acao text NOT NULL,
  responsavel_id uuid,
  responsavel_nome text,
  prazo date,
  fase_pdca text NOT NULL DEFAULT 'PLAN' CHECK (fase_pdca IN ('PLAN','DO','CHECK','ACT','ENCERRADO')),
  evidencia_path text,
  encerrada_em timestamptz,
  observacoes text,
  criada_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inspecao_ncs_planos_nc ON public.inspecao_ncs_planos(nc_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_ncs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_ncs_planos TO authenticated;
GRANT SELECT ON public.inspecao_matriz_rubrica TO authenticated;
GRANT SELECT ON public.inspecao_nr28_valores TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;
GRANT ALL ON public.inspecao_fotos TO service_role;
GRANT ALL ON public.inspecao_ncs TO service_role;
GRANT ALL ON public.inspecao_ncs_planos TO service_role;
GRANT ALL ON public.inspecao_matriz_rubrica TO service_role;
GRANT ALL ON public.inspecao_nr28_valores TO service_role;

ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao_ncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao_ncs_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao_matriz_rubrica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspecao_nr28_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read rubrica" ON public.inspecao_matriz_rubrica FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read nr28" ON public.inspecao_nr28_valores FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read inspecoes" ON public.inspecoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert inspecoes" ON public.inspecoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = aberta_por);
CREATE POLICY "author or tst update" ON public.inspecoes FOR UPDATE TO authenticated
  USING (auth.uid() = aberta_por OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'))
  WITH CHECK (auth.uid() = aberta_por OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));
CREATE POLICY "tst delete" ON public.inspecoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tst'));

CREATE POLICY "auth read fotos" ON public.inspecao_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write fotos" ON public.inspecao_fotos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update fotos" ON public.inspecao_fotos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete fotos" ON public.inspecao_fotos FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth read ncs" ON public.inspecao_ncs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write ncs" ON public.inspecao_ncs FOR INSERT TO authenticated WITH CHECK (auth.uid() = criada_por);
CREATE POLICY "auth update ncs" ON public.inspecao_ncs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete ncs" ON public.inspecao_ncs FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth read planos" ON public.inspecao_ncs_planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write planos" ON public.inspecao_ncs_planos FOR INSERT TO authenticated WITH CHECK (auth.uid() = criada_por);
CREATE POLICY "auth update planos" ON public.inspecao_ncs_planos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete planos" ON public.inspecao_ncs_planos FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.inspecoes_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_inspecoes_touch BEFORE UPDATE ON public.inspecoes FOR EACH ROW EXECUTE FUNCTION public.inspecoes_touch_updated_at();
CREATE TRIGGER trg_inspecao_ncs_touch BEFORE UPDATE ON public.inspecao_ncs FOR EACH ROW EXECUTE FUNCTION public.inspecoes_touch_updated_at();
CREATE TRIGGER trg_inspecao_ncs_planos_touch BEFORE UPDATE ON public.inspecao_ncs_planos FOR EACH ROW EXECUTE FUNCTION public.inspecoes_touch_updated_at();

INSERT INTO public.inspecao_matriz_rubrica (eixo, nivel, rotulo, definicao, exemplo) VALUES
('P',1,'Raro','Pode ocorrer apenas em circunstâncias excepcionais (menos de 1 vez em 10 anos)','Falha simultânea de dois sistemas independentes de proteção'),
('P',2,'Improvável','Pode ocorrer em algum momento (1 vez em 5 a 10 anos)','Incidente registrado no setor uma vez na última década'),
('P',3,'Possível','Pode ocorrer ocasionalmente (1 vez por ano)','Ocorrência registrada em auditorias anteriores'),
('P',4,'Provável','Provavelmente ocorrerá na maioria das circunstâncias (várias vezes por ano)','Desvio observado em inspeções recentes recorrentes'),
('P',5,'Quase certo','Espera-se que ocorra (mensal ou mais frequente)','Prática recorrente já flagrada em DDS/APR/PTE'),
('S',1,'Insignificante','Sem afastamento; primeiros socorros no local','Pequeno corte, contusão leve'),
('S',2,'Menor','Afastamento até 15 dias; sem sequela','Entorse, queimadura de 1º grau'),
('S',3,'Moderada','Afastamento acima de 15 dias; possível sequela reversível','Fratura, queimadura de 2º grau'),
('S',4,'Grave','Invalidez parcial permanente','Amputação de dedo, perda de audição parcial'),
('S',5,'Catastrófica','Óbito ou invalidez permanente total','Queda de altura fatal, explosão em espaço confinado');

INSERT INTO public.inspecao_nr28_valores (gradacao, grau_risco, faixa_min_empregados, faixa_max_empregados, valor_reais, portaria_ref, vigencia_inicio) VALUES
('I1',3,1,10,1006.33,'Portaria MTP vigente','2026-01-01'),
('I1',3,11,25,1207.60,'Portaria MTP vigente','2026-01-01'),
('I1',3,26,50,1408.86,'Portaria MTP vigente','2026-01-01'),
('I1',3,51,100,1610.13,'Portaria MTP vigente','2026-01-01'),
('I1',3,101,250,1811.39,'Portaria MTP vigente','2026-01-01'),
('I1',3,251,500,2012.66,'Portaria MTP vigente','2026-01-01'),
('I1',3,501,1000,2213.92,'Portaria MTP vigente','2026-01-01'),
('I1',3,1001,NULL,2415.19,'Portaria MTP vigente','2026-01-01'),
('I2',3,1,10,2012.66,'Portaria MTP vigente','2026-01-01'),
('I2',3,11,25,2415.19,'Portaria MTP vigente','2026-01-01'),
('I2',3,26,50,2817.72,'Portaria MTP vigente','2026-01-01'),
('I2',3,51,100,3220.26,'Portaria MTP vigente','2026-01-01'),
('I2',3,101,250,3622.79,'Portaria MTP vigente','2026-01-01'),
('I2',3,251,500,4025.32,'Portaria MTP vigente','2026-01-01'),
('I2',3,501,1000,4427.85,'Portaria MTP vigente','2026-01-01'),
('I2',3,1001,NULL,4830.38,'Portaria MTP vigente','2026-01-01'),
('I3',3,1,10,3019.00,'Portaria MTP vigente','2026-01-01'),
('I3',3,11,25,3622.79,'Portaria MTP vigente','2026-01-01'),
('I3',3,26,50,4226.58,'Portaria MTP vigente','2026-01-01'),
('I3',3,51,100,4830.38,'Portaria MTP vigente','2026-01-01'),
('I3',3,101,250,5434.18,'Portaria MTP vigente','2026-01-01'),
('I3',3,251,500,6037.98,'Portaria MTP vigente','2026-01-01'),
('I3',3,501,1000,6641.77,'Portaria MTP vigente','2026-01-01'),
('I3',3,1001,NULL,7245.57,'Portaria MTP vigente','2026-01-01'),
('I4',3,1,10,4025.32,'Portaria MTP vigente','2026-01-01'),
('I4',3,11,25,4830.38,'Portaria MTP vigente','2026-01-01'),
('I4',3,26,50,5635.45,'Portaria MTP vigente','2026-01-01'),
('I4',3,51,100,6440.51,'Portaria MTP vigente','2026-01-01'),
('I4',3,101,250,7245.57,'Portaria MTP vigente','2026-01-01'),
('I4',3,251,500,8050.64,'Portaria MTP vigente','2026-01-01'),
('I4',3,501,1000,8855.70,'Portaria MTP vigente','2026-01-01'),
('I4',3,1001,NULL,9660.77,'Portaria MTP vigente','2026-01-01');
