
-- ============ CASCOS ============
CREATE TABLE public.cascos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  nome TEXT,
  empresa_responsavel_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  encarregado_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cascos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cascos_select ON public.cascos FOR SELECT TO authenticated USING (true);
CREATE POLICY cascos_insert ON public.cascos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cascos_update ON public.cascos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cascos_delete ON public.cascos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cascos_updated_at BEFORE UPDATE ON public.cascos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATALOGO NRs ============
CREATE TABLE public.catalogo_nrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_nrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogo_nrs_select ON public.catalogo_nrs FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_nrs_insert ON public.catalogo_nrs FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY catalogo_nrs_update ON public.catalogo_nrs FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY catalogo_nrs_delete ON public.catalogo_nrs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.catalogo_nrs (codigo, titulo) VALUES
  ('NR-01','Disposições Gerais e Gerenciamento de Riscos Ocupacionais'),
  ('NR-04','Serviços Especializados em Segurança e Medicina do Trabalho - SESMT'),
  ('NR-05','Comissão Interna de Prevenção de Acidentes - CIPA'),
  ('NR-06','Equipamento de Proteção Individual - EPI'),
  ('NR-07','Programa de Controle Médico de Saúde Ocupacional - PCMSO'),
  ('NR-08','Edificações'),
  ('NR-09','Avaliação e Controle das Exposições Ocupacionais a Agentes Físicos, Químicos e Biológicos'),
  ('NR-10','Segurança em Instalações e Serviços em Eletricidade'),
  ('NR-11','Transporte, Movimentação, Armazenagem e Manuseio de Materiais'),
  ('NR-12','Segurança no Trabalho em Máquinas e Equipamentos'),
  ('NR-13','Caldeiras, Vasos de Pressão, Tubulações e Tanques Metálicos de Armazenamento'),
  ('NR-15','Atividades e Operações Insalubres'),
  ('NR-16','Atividades e Operações Perigosas'),
  ('NR-17','Ergonomia'),
  ('NR-18','Segurança e Saúde no Trabalho na Indústria da Construção'),
  ('NR-19','Explosivos'),
  ('NR-20','Segurança e Saúde no Trabalho com Inflamáveis e Combustíveis'),
  ('NR-21','Trabalho a Céu Aberto'),
  ('NR-22','Segurança e Saúde Ocupacional na Mineração'),
  ('NR-23','Proteção Contra Incêndios'),
  ('NR-24','Condições Sanitárias e de Conforto nos Locais de Trabalho'),
  ('NR-25','Resíduos Industriais'),
  ('NR-26','Sinalização de Segurança'),
  ('NR-28','Fiscalização e Penalidades'),
  ('NR-29','Norma Regulamentadora de Segurança e Saúde no Trabalho Portuário'),
  ('NR-30','Segurança e Saúde no Trabalho Aquaviário'),
  ('NR-31','Segurança e Saúde no Trabalho na Agricultura, Pecuária, Silvicultura, Exploração Florestal e Aquicultura'),
  ('NR-32','Segurança e Saúde no Trabalho em Estabelecimentos de Saúde'),
  ('NR-33','Segurança e Saúde nos Trabalhos em Espaços Confinados'),
  ('NR-34','Condições e Meio Ambiente de Trabalho na Indústria da Construção, Reparação e Desmonte Naval'),
  ('NR-35','Trabalho em Altura'),
  ('NR-36','Segurança e Saúde no Trabalho em Empresas de Abate e Processamento de Carnes e Derivados'),
  ('NR-37','Segurança e Saúde em Plataformas de Petróleo'),
  ('NR-38','Segurança e Saúde no Trabalho nas Atividades de Limpeza Urbana e Manejo de Resíduos Sólidos');

-- ============ CATALOGO RISCOS ============
CREATE TABLE public.catalogo_riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL, -- FISICO | QUIMICO | BIOLOGICO | ERGONOMICO | ACIDENTE_MECANICO
  nome TEXT NOT NULL,
  efeitos_tipicos TEXT[] NOT NULL DEFAULT '{}',
  medidas_controle_padrao TEXT[] NOT NULL DEFAULT '{}',
  nrs_aplicaveis TEXT[] NOT NULL DEFAULT '{}',
  epis_sugeridos TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria, nome)
);

ALTER TABLE public.catalogo_riscos ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogo_riscos_select ON public.catalogo_riscos FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogo_riscos_insert ON public.catalogo_riscos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY catalogo_riscos_update ON public.catalogo_riscos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY catalogo_riscos_delete ON public.catalogo_riscos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_catalogo_riscos_updated_at BEFORE UPDATE ON public.catalogo_riscos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.catalogo_riscos (categoria, nome, efeitos_tipicos, medidas_controle_padrao, nrs_aplicaveis, epis_sugeridos) VALUES
-- FÍSICOS
('FISICO','Ruído',
  ARRAY['Perda auditiva','Estresse','Cefaleia'],
  ARRAY['Uso obrigatório de protetor auditivo','Isolamento acústico da fonte','Rodízio de equipe','Avaliação quantitativa periódica'],
  ARRAY['NR-09','NR-15'],
  ARRAY['Protetor Auditivo']),
('FISICO','Calor',
  ARRAY['Desidratação','Insolação','Cãibras','Exaustão térmica'],
  ARRAY['Hidratação constante','Pausas em local fresco','Sombreamento da área','Aclimatação progressiva'],
  ARRAY['NR-09','NR-15','NR-21'],
  ARRAY['Calçado','Capacete','Fardamento leve']),
('FISICO','Radiação não-ionizante (UV/solda)',
  ARRAY['Queimadura ocular','Queimadura de pele','Catarata'],
  ARRAY['Cabines de solda','Biombos de proteção','EPI específico para solda'],
  ARRAY['NR-09','NR-15','NR-34'],
  ARRAY['Máscara de Solda','Avental de raspa','Mangote','Luva de raspa']),
('FISICO','Vibração',
  ARRAY['Distúrbios osteomusculares','Síndrome de Raynaud'],
  ARRAY['Manutenção de equipamentos','Rodízio de tarefas','Luvas anti-vibração'],
  ARRAY['NR-09','NR-15'],
  ARRAY['Luva anti-vibração']),
('FISICO','Umidade',
  ARRAY['Dermatites','Doenças respiratórias'],
  ARRAY['Drenagem da área','EPI impermeável','Trocas de fardamento'],
  ARRAY['NR-15'],
  ARRAY['Bota impermeável','Capa de chuva']),

-- QUÍMICOS
('QUIMICO','Poeira',
  ARRAY['Irritação','Dermatites','Doenças respiratórias','Pneumoconioses'],
  ARRAY['Umidificação da área','Ventilação local exaustora','Uso de respirador'],
  ARRAY['NR-09','NR-15'],
  ARRAY['Respirador PFF2','Óculos','Capacete']),
('QUIMICO','Fumos metálicos (solda)',
  ARRAY['Febre dos fumos metálicos','Doenças pulmonares','Intoxicação'],
  ARRAY['Exaustão local','Respirador com filtro químico','Ventilação geral'],
  ARRAY['NR-09','NR-15','NR-34'],
  ARRAY['Respirador PFF2','Máscara de Solda']),
('QUIMICO','Gases (oxigênio/GLP/acetileno)',
  ARRAY['Asfixia','Explosão','Incêndio','Intoxicação'],
  ARRAY['Inspeção de mangueiras e válvulas','Armazenagem ventilada','Detecção de vazamento','PT específica'],
  ARRAY['NR-13','NR-20','NR-34'],
  ARRAY['Calçado','Capacete','Luva']),
('QUIMICO','Tintas e solventes',
  ARRAY['Intoxicação','Dermatite','Cefaleia'],
  ARRAY['Ventilação','Respirador com filtro químico','Cabine de pintura'],
  ARRAY['NR-09','NR-15'],
  ARRAY['Respirador filtro químico','Luva nitrílica','Macacão Tyvek']),
('QUIMICO','Produtos químicos diversos',
  ARRAY['Queimaduras','Irritação','Intoxicação'],
  ARRAY['FISPQ disponível','EPI compatível','Treinamento NR-26'],
  ARRAY['NR-09','NR-15','NR-26'],
  ARRAY['Luva nitrílica','Óculos','Avental']),

-- BIOLÓGICOS
('BIOLOGICO','Contato com água contaminada',
  ARRAY['Leptospirose','Hepatite A','Doenças gastrointestinais'],
  ARRAY['Vacinação','Higienização','EPI impermeável'],
  ARRAY['NR-09','NR-32'],
  ARRAY['Bota impermeável','Luva nitrílica']),
('BIOLOGICO','Animais peçonhentos',
  ARRAY['Picadas','Envenenamento','Reações alérgicas'],
  ARRAY['Inspeção da área','Treinamento de primeiros socorros','Roçagem periódica'],
  ARRAY['NR-21','NR-31'],
  ARRAY['Perneira','Bota de cano alto','Luva']),

-- ERGONÔMICOS
('ERGONOMICO','Levantamento e movimentação de material',
  ARRAY['Lesões na coluna','Hérnia de disco','Escoriações','Prensamentos'],
  ARRAY['Auxílio mecânico (talha/empilhadeira)','Treinamento de levantamento','Trabalho em dupla','Limite de peso'],
  ARRAY['NR-11','NR-17'],
  ARRAY['Luva','Calçado','Capacete']),
('ERGONOMICO','Postura inadequada',
  ARRAY['Dores musculoesqueléticas','LER/DORT'],
  ARRAY['Análise ergonômica','Pausas','Rodízio de tarefas','Mobiliário adequado'],
  ARRAY['NR-17'],
  ARRAY[]::text[]),
('ERGONOMICO','Esforço físico repetitivo',
  ARRAY['LER/DORT','Tendinite'],
  ARRAY['Pausas programadas','Rodízio','Ginástica laboral'],
  ARRAY['NR-17'],
  ARRAY[]::text[]),
('ERGONOMICO','Jornada prolongada',
  ARRAY['Fadiga','Estresse','Acidentes por desatenção'],
  ARRAY['Controle de jornada','Pausas','Hidratação'],
  ARRAY['NR-17'],
  ARRAY[]::text[]),

-- ACIDENTES MECÂNICOS
('ACIDENTE_MECANICO','Queda de mesmo nível',
  ARRAY['Torção','Entorse','Escoriações','Fraturas'],
  ARRAY['Organização da área','Sinalização','Calçado adequado','Limpeza de óleo/água'],
  ARRAY['NR-01','NR-08'],
  ARRAY['Calçado de segurança']),
('ACIDENTE_MECANICO','Queda de altura',
  ARRAY['Fraturas graves','Politraumatismo','Óbito'],
  ARRAY['Cinto paraquedista','Linha de vida','Análise de ancoragem','APR e PT específica','Treinamento NR-35'],
  ARRAY['NR-35','NR-34'],
  ARRAY['Cinto paraquedista','Talabarte','Capacete com jugular','Calçado']),
('ACIDENTE_MECANICO','Queda de objetos',
  ARRAY['Contusões','Fraturas','Traumas cranianos'],
  ARRAY['Isolamento da área inferior','Amarração de ferramentas','Sinalização vertical'],
  ARRAY['NR-18','NR-34'],
  ARRAY['Capacete','Calçado']),
('ACIDENTE_MECANICO','Projeção de partículas',
  ARRAY['Lesão ocular','Cortes','Queimaduras'],
  ARRAY['Biombo de proteção','EPI ocular','Isolamento da área'],
  ARRAY['NR-09','NR-12'],
  ARRAY['Óculos','Protetor facial']),
('ACIDENTE_MECANICO','Contato com peça quente',
  ARRAY['Queimaduras','Bolhas'],
  ARRAY['Sinalização de superfície quente','Aguardar resfriamento','EPI térmico'],
  ARRAY['NR-12','NR-34'],
  ARRAY['Luva de raspa','Avental de raspa','Mangote']),
('ACIDENTE_MECANICO','Choque elétrico',
  ARRAY['Queimaduras','Parada cardiorrespiratória','Óbito'],
  ARRAY['Desenergização','Bloqueio e etiquetagem','Profissional habilitado','Treinamento NR-10'],
  ARRAY['NR-10'],
  ARRAY['Luva isolante','Calçado isolante','Capacete classe B']),
('ACIDENTE_MECANICO','Incêndio e explosão',
  ARRAY['Queimaduras','Asfixia','Óbito'],
  ARRAY['Extintores acessíveis','Vigia de fogo','Remoção de inflamáveis','PT trabalho a quente'],
  ARRAY['NR-20','NR-23','NR-34'],
  ARRAY['Avental de raspa','Capacete','Calçado']),
('ACIDENTE_MECANICO','Espaço confinado',
  ARRAY['Asfixia','Intoxicação','Explosão','Óbito'],
  ARRAY['PET espaço confinado','Medição atmosférica contínua','Vigia','Resgate planejado','Treinamento NR-33'],
  ARRAY['NR-33'],
  ARRAY['Cinto resgate','Tripé','Detector de gases','Respirador autônomo']),
('ACIDENTE_MECANICO','Içamento de carga',
  ARRAY['Esmagamento','Queda de carga','Óbito'],
  ARRAY['Inspeção de cabos e cintas','Operador habilitado','Isolamento da área','Sinaleiro','PT içamento'],
  ARRAY['NR-11','NR-18','NR-34'],
  ARRAY['Capacete','Calçado','Luva']),
('ACIDENTE_MECANICO','Ferramentas manuais',
  ARRAY['Cortes','Perfurações','Contusões'],
  ARRAY['Inspeção pré-uso','Ferramenta correta para a tarefa','Treinamento'],
  ARRAY['NR-12'],
  ARRAY['Luva','Óculos']),
('ACIDENTE_MECANICO','Atropelamento',
  ARRAY['Politraumatismo','Óbito'],
  ARRAY['Sinalização','Separação de fluxo de pessoas e veículos','Velocidade controlada'],
  ARRAY['NR-11','NR-12'],
  ARRAY['Colete refletivo','Calçado','Capacete']);
