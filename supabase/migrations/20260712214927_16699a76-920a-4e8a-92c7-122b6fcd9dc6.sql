
-- =========================================================
-- MÓDULO PSICOSSOCIAL NR-01 (Portaria MTP 1.419/2024)
-- Base: ISO 45003:2021 + Guia MTE 2025 + HSE Indicator Tool
-- =========================================================

-- 1) Estende categoria do inventário para aceitar PSICOSSOCIAL
ALTER TABLE public.pgr_inventario_riscos
  DROP CONSTRAINT IF EXISTS pgr_inventario_riscos_categoria_check;
ALTER TABLE public.pgr_inventario_riscos
  ADD CONSTRAINT pgr_inventario_riscos_categoria_check
  CHECK (categoria IN ('FISICO','QUIMICO','BIOLOGICO','ERGONOMICO','ACIDENTE','PSICOSSOCIAL'));

-- 2) Catálogo-mãe de perigos psicossociais (universal, qualquer CNAE)
CREATE TABLE public.catalogo_perigos_psicossociais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimensao TEXT NOT NULL,           -- ex.: DEMANDAS, CONTROLE, APOIO, RECOMPENSA, PAPEL_MUDANCA, RELACOES, VIOLENCIA, INTERFACE
  codigo TEXT NOT NULL UNIQUE,      -- ex.: DEM-01
  perigo TEXT NOT NULL,
  agravo TEXT,
  fonte_tipica TEXT,
  controles_sugeridos TEXT,
  iso45003_ref TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_psico_dimensao ON public.catalogo_perigos_psicossociais(dimensao);

GRANT SELECT ON public.catalogo_perigos_psicossociais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_perigos_psicossociais TO authenticated;
GRANT ALL ON public.catalogo_perigos_psicossociais TO service_role;

ALTER TABLE public.catalogo_perigos_psicossociais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_psico_select" ON public.catalogo_perigos_psicossociais
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "cat_psico_insert" ON public.catalogo_perigos_psicossociais
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "cat_psico_update" ON public.catalogo_perigos_psicossociais
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "cat_psico_delete" ON public.catalogo_perigos_psicossociais
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_cat_psico_updated_at
  BEFORE UPDATE ON public.catalogo_perigos_psicossociais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed do catálogo (8 dimensões × ~35 perigos)
INSERT INTO public.catalogo_perigos_psicossociais (dimensao, codigo, perigo, agravo, fonte_tipica, controles_sugeridos, iso45003_ref, ordem) VALUES
-- 1. DEMANDAS
('DEMANDAS','DEM-01','Sobrecarga de trabalho (volume)','Estresse crônico, burnout, transtornos ansiosos','Dimensionamento inadequado, acúmulo de funções','Revisão de dimensionamento; pausas programadas; redistribuição de tarefas','ISO 45003 6.1.2.2', 1),
('DEMANDAS','DEM-02','Pressão de prazo / ritmo intenso','Ansiedade, erros, acidentes por pressa','Metas irrealistas, produção puxada','Planejamento realista; folgas de prazo; envolvimento da equipe no cronograma','ISO 45003 6.1.2.2', 2),
('DEMANDAS','DEM-03','Jornada extensa / hora extra habitual','Fadiga, distúrbios do sono, doenças cardiovasculares','Cultura de horas extras, escassez de mão de obra','Controle de jornada; limite de HE; contratação','ISO 45003 6.1.2.4', 3),
('DEMANDAS','DEM-04','Exigência emocional (contato com sofrimento/agressividade)','Fadiga por compaixão, estresse pós-traumático','Atendimento ao público, saúde, atendimento a acidentados','Rodízio; suporte psicológico; supervisão clínica','ISO 45003 6.1.2.2', 4),
('DEMANDAS','DEM-05','Trabalho monótono / repetitivo cognitivo','Desmotivação, distração, erros','Tarefas de baixa variabilidade','Rotação de tarefas; enriquecimento do cargo','ISO 45003 6.1.2.2', 5),

-- 2. CONTROLE
('CONTROLE','CTR-01','Baixa autonomia / microgerenciamento','Estresse, desengajamento, adoecimento mental','Estilo de liderança controlador','Delegação; capacitação de líderes; matriz de decisão','ISO 45003 6.1.2.2', 10),
('CONTROLE','CTR-02','Falta de participação em decisões que afetam o trabalho','Sentimento de impotência, resistência a mudanças','Decisões unilaterais','Comitês, canais de sugestão, reuniões participativas','ISO 45003 6.1.2.2', 11),
('CONTROLE','CTR-03','Ritmo imposto por máquina/esteira','Fadiga, tensão, LER/DORT','Linha de produção','Pausas programadas; velocidade ajustável','ISO 45003 6.1.2.2', 12),

-- 3. APOIO SOCIAL
('APOIO','APO-01','Falta de apoio da liderança','Isolamento, adoecimento mental, turnover','Líderes despreparados, ausência de feedback','Treinamento de liderança; reuniões 1:1; canal de escuta','ISO 45003 6.1.2.3', 20),
('APOIO','APO-02','Falta de apoio dos pares / clima competitivo hostil','Solidão, ansiedade','Cultura individualista','Trabalho em equipe; celebrações coletivas; mentoria','ISO 45003 6.1.2.3', 21),
('APOIO','APO-03','Isolamento (trabalho remoto/noturno/solitário)','Ansiedade, depressão','Home office integral, turnos noturnos, postos isolados','Reuniões periódicas; check-ins; rodízio','ISO 45003 6.1.2.4', 22),

-- 4. RECOMPENSA (ERI/Siegrist)
('RECOMPENSA','REC-01','Baixo reconhecimento pelo trabalho','Desmotivação, adoecimento mental','Cultura sem feedback positivo','Reconhecimento formal e informal; premiações','ISO 45003 6.1.2.3', 30),
('RECOMPENSA','REC-02','Salário/benefícios percebidos como injustos','Insatisfação, saída, ações trabalhistas','Política salarial opaca','Transparência salarial; equidade interna','ISO 45003 6.1.2.3', 31),
('RECOMPENSA','REC-03','Falta de perspectiva de crescimento','Estagnação, adoecimento','Ausência de plano de carreira','Plano de cargos e salários; PDI','ISO 45003 6.1.2.3', 32),

-- 5. PAPEL E MUDANÇA
('PAPEL_MUDANCA','PAP-01','Ambiguidade de papel (não sabe o que se espera)','Ansiedade, retrabalho, conflito','Descrição de cargo inexistente/vaga','Descrição de cargo clara; onboarding','ISO 45003 6.1.2.2', 40),
('PAPEL_MUDANCA','PAP-02','Conflito de papéis (ordens contraditórias)','Estresse, paralisia decisória','Múltiplos chefes, matriz mal desenhada','Cadeia de comando clara; matriz RACI','ISO 45003 6.1.2.2', 41),
('PAPEL_MUDANCA','PAP-03','Mudança organizacional mal comunicada','Insegurança, boatos, adoecimento','Reestruturações, M&A','Comunicação transparente; envolvimento precoce','ISO 45003 6.1.2.4', 42),

-- 6. RELAÇÕES INTERPESSOAIS
('RELACOES','REL-01','Assédio moral','Depressão, ideação suicida, afastamento','Liderança tóxica, cultura permissiva','Canal de denúncia; investigação séria; treinamento de líderes','ISO 45003 6.1.2.3', 50),
('RELACOES','REL-02','Assédio sexual','Trauma, adoecimento mental, saída forçada','Cultura sexista, ausência de canal seguro','Política clara; canal seguro; sanções firmes','ISO 45003 6.1.2.3', 51),
('RELACOES','REL-03','Discriminação (raça, gênero, orientação, idade, deficiência)','Isolamento, adoecimento mental','Cultura excludente','Política DEI; treinamento; canal de denúncia','ISO 45003 6.1.2.3', 52),
('RELACOES','REL-04','Conflitos interpessoais recorrentes não mediados','Estresse, absenteísmo, brigas','Falta de mediação','Mediação de conflitos; código de conduta','ISO 45003 6.1.2.3', 53),

-- 7. VIOLÊNCIA NO TRABALHO
('VIOLENCIA','VIO-01','Violência de terceiros (cliente, público)','Trauma, medo, afastamento','Atendimento ao público, segurança, portaria','Treinamento; layout seguro; segurança armada quando aplicável','ISO 45003 6.1.2.3', 60),
('VIOLENCIA','VIO-02','Ameaça / agressão física interna','Trauma, ferimento','Conflitos escalados','Canal de denúncia; afastamento imediato do agressor','ISO 45003 6.1.2.3', 61),
('VIOLENCIA','VIO-03','Violência doméstica com reflexo no trabalho','Absenteísmo, adoecimento, risco de vida','Trabalhadores em situação de VD','Política de acolhimento; encaminhamento à rede de apoio','ISO 45003 6.1.2.4', 62),

-- 8. INTERFACE TRABALHO-VIDA
('INTERFACE','INT-01','Conectividade fora do expediente (WhatsApp, e-mail)','Fadiga, ansiedade, insônia','Cultura do "sempre disponível"','Política de direito à desconexão; horários definidos','ISO 45003 6.1.2.4', 70),
('INTERFACE','INT-02','Escala/turno que impede vida social/familiar','Depressão, conflito familiar, divórcio','Turnos rotativos mal desenhados','Escala previsível; consulta à equipe; folgas em fins de semana','ISO 45003 6.1.2.4', 71),
('INTERFACE','INT-03','Insegurança no emprego (medo de demissão)','Ansiedade, adoecimento mental','Ciclos de demissão, contratos precários','Comunicação transparente; segurança psicológica','ISO 45003 6.1.2.4', 72),
('INTERFACE','INT-04','Deslocamento casa-trabalho excessivo (>2h/dia)','Fadiga, adoecimento, acidentes','Localização distante, transporte precário','Fretado; home office parcial; horário flexível','ISO 45003 6.1.2.4', 73);

-- 3) Campanhas de coleta
CREATE TABLE public.psico_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  instrumento TEXT NOT NULL DEFAULT 'HSE_IT_BR' CHECK (instrumento IN ('HSE_IT_BR','ISO45003_SIGMO','CUSTOM')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ghe_ids UUID[] NOT NULL DEFAULT '{}',
  min_respondentes INT NOT NULL DEFAULT 5 CHECK (min_respondentes >= 3),
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','ATIVA','ENCERRADA','CANCELADA')),
  total_tokens INT NOT NULL DEFAULT 0,
  total_respostas INT NOT NULL DEFAULT 0,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psico_camp_status ON public.psico_campanhas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_campanhas TO authenticated;
GRANT ALL ON public.psico_campanhas TO service_role;
ALTER TABLE public.psico_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_camp_select" ON public.psico_campanhas
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "psico_camp_insert" ON public.psico_campanhas
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "psico_camp_update" ON public.psico_campanhas
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "psico_camp_delete" ON public.psico_campanhas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_psico_camp_updated_at
  BEFORE UPDATE ON public.psico_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Tokens descartáveis (sem user_id — anonimato por design)
CREATE TABLE public.psico_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  usado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psico_tok_camp ON public.psico_tokens(campanha_id);
CREATE INDEX idx_psico_tok_hash ON public.psico_tokens(token_hash);

GRANT SELECT, INSERT, UPDATE ON public.psico_tokens TO authenticated;
-- anon precisa validar o próprio token na rota pública /psico/:token
GRANT SELECT, UPDATE ON public.psico_tokens TO anon;
GRANT ALL ON public.psico_tokens TO service_role;

ALTER TABLE public.psico_tokens ENABLE ROW LEVEL SECURITY;
-- Editor lista/cria; anon só valida por hash específico via server function
CREATE POLICY "psico_tok_select_auth" ON public.psico_tokens
  FOR SELECT TO authenticated USING (public.is_editor(auth.uid()));
CREATE POLICY "psico_tok_insert_auth" ON public.psico_tokens
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "psico_tok_update_auth" ON public.psico_tokens
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid()));
-- anon: bloqueado no cliente; leitura/atualização acontecem via server function pública com service role

-- 5) Respostas anônimas (SEM user_id, JAMAIS)
CREATE TABLE public.psico_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  ghe_id UUID REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  dimensao TEXT NOT NULL,
  item_codigo TEXT NOT NULL,       -- ex.: HSE-Q07, ISO-VIO-01
  valor INT NOT NULL CHECK (valor BETWEEN 1 AND 5),  -- Likert
  faixa_etaria TEXT,               -- opcional, faixa não-identificante
  faixa_tempo_casa TEXT,           -- opcional
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psico_resp_camp ON public.psico_respostas(campanha_id);
CREATE INDEX idx_psico_resp_ghe ON public.psico_respostas(ghe_id);
CREATE INDEX idx_psico_resp_dim ON public.psico_respostas(dimensao);

GRANT SELECT ON public.psico_respostas TO authenticated;
GRANT INSERT ON public.psico_respostas TO anon;
GRANT ALL ON public.psico_respostas TO service_role;

ALTER TABLE public.psico_respostas ENABLE ROW LEVEL SECURITY;

-- Autenticados leem SÓ AGREGADO via view abaixo; leitura da tabela crua é editor+.
CREATE POLICY "psico_resp_select_editor" ON public.psico_respostas
  FOR SELECT TO authenticated USING (public.is_editor(auth.uid()));

-- Anon pode inserir apenas se o token existe, não foi usado e não expirou.
-- Validação principal fica na server function pública; policy aqui é defesa em profundidade.
CREATE POLICY "psico_resp_insert_anon" ON public.psico_respostas
  FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.psico_campanhas c
      WHERE c.id = campanha_id
        AND c.status = 'ATIVA'
        AND CURRENT_DATE BETWEEN c.data_inicio AND c.data_fim
    )
  );

-- 6) Consentimento LGPD (separado, hash do token, sem vínculo com resposta)
CREATE TABLE public.psico_consentimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.psico_campanhas(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  versao_termo TEXT NOT NULL DEFAULT 'v1.2026-07',
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  ua_hash TEXT
);
CREATE INDEX idx_psico_cons_camp ON public.psico_consentimentos(campanha_id);

GRANT SELECT ON public.psico_consentimentos TO authenticated;
GRANT INSERT ON public.psico_consentimentos TO anon;
GRANT ALL ON public.psico_consentimentos TO service_role;
ALTER TABLE public.psico_consentimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psico_cons_select_admin" ON public.psico_consentimentos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "psico_cons_insert_anon" ON public.psico_consentimentos
  FOR INSERT TO anon WITH CHECK (true);

-- 7) View agregada com supressão n<5 (LGPD)
CREATE OR REPLACE VIEW public.v_psico_agregado_ghe_dim
WITH (security_invoker = true) AS
SELECT
  r.campanha_id,
  r.ghe_id,
  r.dimensao,
  COUNT(*) AS n_respostas,
  ROUND(AVG(r.valor)::numeric, 2) AS media,
  CASE
    WHEN (SELECT min_respondentes FROM public.psico_campanhas c WHERE c.id = r.campanha_id) >
         (SELECT COUNT(DISTINCT t.id) FROM public.psico_tokens t
          WHERE t.campanha_id = r.campanha_id AND t.usado_em IS NOT NULL AND t.ghe_id = r.ghe_id)
      THEN true
    ELSE false
  END AS suprimido
FROM public.psico_respostas r
GROUP BY r.campanha_id, r.ghe_id, r.dimensao;

GRANT SELECT ON public.v_psico_agregado_ghe_dim TO authenticated;

-- 8) Trigger: marca token como usado ao inserir resposta (single-use)
--    (validação principal fica na server function; trigger é backup)
CREATE OR REPLACE FUNCTION public.psico_after_insert_resposta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Atualiza contador da campanha
  UPDATE public.psico_campanhas
     SET total_respostas = total_respostas + 1,
         updated_at = now()
   WHERE id = NEW.campanha_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_psico_after_resp
  AFTER INSERT ON public.psico_respostas
  FOR EACH ROW EXECUTE FUNCTION public.psico_after_insert_resposta();

-- 9) Trigger no token: contador
CREATE OR REPLACE FUNCTION public.psico_after_insert_token()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.psico_campanhas
     SET total_tokens = total_tokens + 1,
         updated_at = now()
   WHERE id = NEW.campanha_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_psico_after_tok
  AFTER INSERT ON public.psico_tokens
  FOR EACH ROW EXECUTE FUNCTION public.psico_after_insert_token();
