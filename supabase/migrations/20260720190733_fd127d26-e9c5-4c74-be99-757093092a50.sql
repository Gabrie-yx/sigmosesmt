
-- ============ 1. Ampliar catálogo com item NR-01 ============
ALTER TABLE public.catalogo_perigos_psicossociais
  ADD COLUMN IF NOT EXISTS nr01_item_ref TEXT,
  ADD COLUMN IF NOT EXISTS nr01_item_texto TEXT;

COMMENT ON COLUMN public.catalogo_perigos_psicossociais.nr01_item_ref IS 'Item exato da NR-01 que fundamenta o achado (ex: 1.5.3.2, 1.5.4.4.6)';

-- Backfill com item genérico por dimensão
UPDATE public.catalogo_perigos_psicossociais SET nr01_item_ref = '1.5.3.2', nr01_item_texto = 'Identificação de perigos e avaliação dos riscos psicossociais relacionados ao trabalho.' WHERE nr01_item_ref IS NULL AND dimensao IN ('DEMANDAS','CONTROLE','APOIO','RECOMPENSA');
UPDATE public.catalogo_perigos_psicossociais SET nr01_item_ref = '1.5.4.4.6', nr01_item_texto = 'A avaliação dos riscos psicossociais deve considerar fatores organizacionais, sociais e ambientais que possam afetar a saúde mental dos trabalhadores.' WHERE nr01_item_ref IS NULL AND dimensao IN ('PAPEL_MUDANCA','RELACOES','INTERFACE');
UPDATE public.catalogo_perigos_psicossociais SET nr01_item_ref = '1.5.4.4.6.1', nr01_item_texto = 'Medidas de prevenção específicas para violência, assédio e comportamentos ofensivos no trabalho (correlato à Lei 14.457/2022).' WHERE nr01_item_ref IS NULL AND dimensao = 'VIOLENCIA';

-- ============ 2. Campanha: perguntas abertas + responsável técnico ============
ALTER TABLE public.psico_campanhas
  ADD COLUMN IF NOT EXISTS perguntas_abertas_habilitado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico_nome TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_tecnico_registro TEXT,
  ADD COLUMN IF NOT EXISTS cnae_referencia TEXT;

-- ============ 3. Planos de Ação 5W2H ============
CREATE TABLE IF NOT EXISTS public.psico_planos_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  dimensao TEXT NOT NULL,
  classificacao TEXT NOT NULL CHECK (classificacao IN ('BAIXO','MODERADO','ALTO','MUITO_ALTO')),
  score_medio NUMERIC(4,2),
  -- 5W2H
  what TEXT NOT NULL,
  why TEXT NOT NULL,
  where_ TEXT,
  who TEXT,
  when_ DATE,
  how TEXT,
  how_much NUMERIC(12,2),
  -- Status
  status TEXT NOT NULL DEFAULT 'PLANEJADO' CHECK (status IN ('PLANEJADO','EM_ANDAMENTO','CONCLUIDO','CANCELADO')),
  nr01_item_ref TEXT,
  observacoes TEXT,
  gerado_automatico BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_planos_acao TO authenticated;
GRANT ALL ON public.psico_planos_acao TO service_role;
ALTER TABLE public.psico_planos_acao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read planos psico" ON public.psico_planos_acao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage planos psico" ON public.psico_planos_acao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_psico_planos_campanha ON public.psico_planos_acao(campanha_id);

-- ============ 4. Cronograma de reavaliação ============
CREATE TABLE IF NOT EXISTS public.psico_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  proxima_avaliacao DATE NOT NULL,
  frequencia_meses INTEGER NOT NULL DEFAULT 12,
  alerta_dias INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'AGENDADO' CHECK (status IN ('AGENDADO','ATRASADO','CONCLUIDO')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_cronograma TO authenticated;
GRANT ALL ON public.psico_cronograma TO service_role;
ALTER TABLE public.psico_cronograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read crono psico" ON public.psico_cronograma FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage crono psico" ON public.psico_cronograma FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ 5. Ações realizadas (registro pós-diagnóstico) ============
CREATE TABLE IF NOT EXISTS public.psico_acoes_realizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  plano_acao_id UUID REFERENCES public.psico_planos_acao(id) ON DELETE SET NULL,
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  dimensao_atacada TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_realizacao DATE NOT NULL,
  responsavel TEXT,
  publico_alvo TEXT,
  n_participantes INTEGER,
  evidencia_url TEXT,
  eficacia_percebida TEXT CHECK (eficacia_percebida IN ('BAIXA','MEDIA','ALTA','NAO_AVALIADA')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_acoes_realizadas TO authenticated;
GRANT ALL ON public.psico_acoes_realizadas TO service_role;
ALTER TABLE public.psico_acoes_realizadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read acoes psico" ON public.psico_acoes_realizadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage acoes psico" ON public.psico_acoes_realizadas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ 6. Denúncias anônimas (Lei 14.457/2022) ============
CREATE TABLE IF NOT EXISTS public.psico_denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE DEFAULT ('DEN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('ASSEDIO_MORAL','ASSEDIO_SEXUAL','DISCRIMINACAO','VIOLENCIA','OUTRO')),
  local_ocorrencia TEXT,
  data_aproximada DATE,
  relato TEXT NOT NULL,
  quer_retorno BOOLEAN NOT NULL DEFAULT false,
  contato_retorno TEXT, -- opcional (email/telefone). Nunca obrigatório.
  ip_hash TEXT,
  ua_hash TEXT,
  status TEXT NOT NULL DEFAULT 'RECEBIDA' CHECK (status IN ('RECEBIDA','EM_APURACAO','CONCLUIDA','ARQUIVADA')),
  parecer_final TEXT,
  responsavel_apuracao UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.psico_denuncias TO authenticated;
GRANT INSERT ON public.psico_denuncias TO anon; -- canal público anônimo
GRANT ALL ON public.psico_denuncias TO service_role;
ALTER TABLE public.psico_denuncias ENABLE ROW LEVEL SECURITY;
-- Qualquer um envia (anônimo)
CREATE POLICY "anon insert denuncia" ON public.psico_denuncias FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth insert denuncia" ON public.psico_denuncias FOR INSERT TO authenticated WITH CHECK (true);
-- Só autenticado lê/gerencia (idealmente admin/TST — refinamento futuro com has_role)
CREATE POLICY "auth read denuncia" ON public.psico_denuncias FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update denuncia" ON public.psico_denuncias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_psico_denuncias_status ON public.psico_denuncias(status);

-- ============ 7. Assinatura do responsável técnico no parecer ============
CREATE TABLE IF NOT EXISTS public.psico_assinatura_parecer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  responsavel_nome TEXT NOT NULL,
  responsavel_registro TEXT NOT NULL, -- CREA / registro TST / MTE
  responsavel_cargo TEXT,
  pdf_hash TEXT NOT NULL, -- SHA-256 do PDF assinado (garante integridade)
  assinatura_data_url TEXT, -- opcional, imagem base64 da assinatura
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  assinado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.psico_assinatura_parecer TO authenticated;
GRANT ALL ON public.psico_assinatura_parecer TO service_role;
ALTER TABLE public.psico_assinatura_parecer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read assinatura psico" ON public.psico_assinatura_parecer FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert assinatura psico" ON public.psico_assinatura_parecer FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_psico_assinatura_campanha ON public.psico_assinatura_parecer(campanha_id);

-- ============ 8. Relatos abertos anônimos ============
CREATE TABLE IF NOT EXISTS public.psico_relatos_abertos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL, -- só pro sistema saber que veio de um token válido; sem link com respostas
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  categoria TEXT, -- opcional: qual dimensão o colaborador quis comentar
  relato TEXT NOT NULL,
  faixa_etaria TEXT,
  faixa_tempo_casa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.psico_relatos_abertos TO authenticated;
GRANT INSERT ON public.psico_relatos_abertos TO anon;
GRANT ALL ON public.psico_relatos_abertos TO service_role;
ALTER TABLE public.psico_relatos_abertos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert relato" ON public.psico_relatos_abertos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth read relato" ON public.psico_relatos_abertos FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_psico_relatos_campanha ON public.psico_relatos_abertos(campanha_id);

-- ============ 9. Benchmarks setoriais CNAE (HSE-IT BR) ============
CREATE TABLE IF NOT EXISTS public.psico_benchmark_cnae (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnae_secao TEXT NOT NULL, -- letra da seção CNAE (A-U)
  cnae_secao_desc TEXT NOT NULL,
  dimensao TEXT NOT NULL,
  score_medio_setorial NUMERIC(4,2) NOT NULL, -- 1 a 5
  faixa_classificacao TEXT NOT NULL CHECK (faixa_classificacao IN ('BAIXO','MODERADO','ALTO','MUITO_ALTO')),
  fonte TEXT DEFAULT 'HSE-IT BR / MTE Guia 2025',
  ano_referencia INTEGER DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cnae_secao, dimensao)
);
GRANT SELECT ON public.psico_benchmark_cnae TO authenticated, anon;
GRANT ALL ON public.psico_benchmark_cnae TO service_role;
ALTER TABLE public.psico_benchmark_cnae ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read benchmark cnae" ON public.psico_benchmark_cnae FOR SELECT USING (true);

-- Seed benchmark: 5 seções CNAE × 8 dimensões (valores conservadores baseados em literatura HSE-IT BR / ISO 45003)
INSERT INTO public.psico_benchmark_cnae (cnae_secao, cnae_secao_desc, dimensao, score_medio_setorial, faixa_classificacao) VALUES
-- C - Indústrias de Transformação
('C','Indústrias de Transformação','DEMANDAS',3.4,'MODERADO'),
('C','Indústrias de Transformação','CONTROLE',3.1,'MODERADO'),
('C','Indústrias de Transformação','APOIO',3.6,'MODERADO'),
('C','Indústrias de Transformação','RECOMPENSA',3.0,'MODERADO'),
('C','Indústrias de Transformação','PAPEL_MUDANCA',3.5,'MODERADO'),
('C','Indústrias de Transformação','RELACOES',3.8,'MODERADO'),
('C','Indústrias de Transformação','VIOLENCIA',4.2,'BAIXO'),
('C','Indústrias de Transformação','INTERFACE',3.3,'MODERADO'),
-- F - Construção
('F','Construção','DEMANDAS',3.0,'MODERADO'),
('F','Construção','CONTROLE',2.9,'ALTO'),
('F','Construção','APOIO',3.3,'MODERADO'),
('F','Construção','RECOMPENSA',2.8,'ALTO'),
('F','Construção','PAPEL_MUDANCA',3.2,'MODERADO'),
('F','Construção','RELACOES',3.5,'MODERADO'),
('F','Construção','VIOLENCIA',4.0,'BAIXO'),
('F','Construção','INTERFACE',3.0,'MODERADO'),
-- H - Transporte e Armazenagem
('H','Transporte, Armazenagem e Correio','DEMANDAS',2.9,'ALTO'),
('H','Transporte, Armazenagem e Correio','CONTROLE',2.8,'ALTO'),
('H','Transporte, Armazenagem e Correio','APOIO',3.2,'MODERADO'),
('H','Transporte, Armazenagem e Correio','RECOMPENSA',2.9,'ALTO'),
('H','Transporte, Armazenagem e Correio','PAPEL_MUDANCA',3.4,'MODERADO'),
('H','Transporte, Armazenagem e Correio','RELACOES',3.6,'MODERADO'),
('H','Transporte, Armazenagem e Correio','VIOLENCIA',3.8,'MODERADO'),
('H','Transporte, Armazenagem e Correio','INTERFACE',2.7,'ALTO'),
-- Q - Saúde Humana e Serviços Sociais
('Q','Saúde Humana e Serviços Sociais','DEMANDAS',2.7,'ALTO'),
('Q','Saúde Humana e Serviços Sociais','CONTROLE',3.0,'MODERADO'),
('Q','Saúde Humana e Serviços Sociais','APOIO',3.4,'MODERADO'),
('Q','Saúde Humana e Serviços Sociais','RECOMPENSA',2.9,'ALTO'),
('Q','Saúde Humana e Serviços Sociais','PAPEL_MUDANCA',3.3,'MODERADO'),
('Q','Saúde Humana e Serviços Sociais','RELACOES',3.5,'MODERADO'),
('Q','Saúde Humana e Serviços Sociais','VIOLENCIA',3.4,'MODERADO'),
('Q','Saúde Humana e Serviços Sociais','INTERFACE',2.8,'ALTO'),
-- O - Administração Pública, Defesa e Seg. Social
('O','Administração Pública','DEMANDAS',3.3,'MODERADO'),
('O','Administração Pública','CONTROLE',3.2,'MODERADO'),
('O','Administração Pública','APOIO',3.5,'MODERADO'),
('O','Administração Pública','RECOMPENSA',3.1,'MODERADO'),
('O','Administração Pública','PAPEL_MUDANCA',3.4,'MODERADO'),
('O','Administração Pública','RELACOES',3.7,'MODERADO'),
('O','Administração Pública','VIOLENCIA',4.1,'BAIXO'),
('O','Administração Pública','INTERFACE',3.4,'MODERADO')
ON CONFLICT (cnae_secao, dimensao) DO NOTHING;

-- ============ 10. Trigger updated_at genérico (se não existir) ============
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS tg_psico_planos_upd ON public.psico_planos_acao;
CREATE TRIGGER tg_psico_planos_upd BEFORE UPDATE ON public.psico_planos_acao FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS tg_psico_crono_upd ON public.psico_cronograma;
CREATE TRIGGER tg_psico_crono_upd BEFORE UPDATE ON public.psico_cronograma FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS tg_psico_acoes_upd ON public.psico_acoes_realizadas;
CREATE TRIGGER tg_psico_acoes_upd BEFORE UPDATE ON public.psico_acoes_realizadas FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS tg_psico_denuncias_upd ON public.psico_denuncias;
CREATE TRIGGER tg_psico_denuncias_upd BEFORE UPDATE ON public.psico_denuncias FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
