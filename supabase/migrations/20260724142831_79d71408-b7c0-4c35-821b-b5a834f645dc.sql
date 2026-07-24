-- =========================================================
-- Fila Curta: snippets + role templates + pdf attachments
-- =========================================================

-- ---------- SNIPPETS ----------
CREATE TABLE public.snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  escopo TEXT NOT NULL CHECK (escopo IN ('apr','oss','inspecao','plano_acao','generico')),
  campo_alvo TEXT,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  oficial BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_snippets_escopo ON public.snippets(escopo);
CREATE INDEX idx_snippets_created_by ON public.snippets(created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.snippets TO authenticated;
GRANT ALL ON public.snippets TO service_role;
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snippets_read_all_authenticated"
  ON public.snippets FOR SELECT TO authenticated USING (true);

CREATE POLICY "snippets_insert_own_or_admin"
  ON public.snippets FOR INSERT TO authenticated
  WITH CHECK (
    (oficial = false AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "snippets_update_own_or_admin"
  ON public.snippets FOR UPDATE TO authenticated
  USING (
    (oficial = false AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (oficial = false AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "snippets_delete_own_or_admin"
  ON public.snippets FOR DELETE TO authenticated
  USING (
    (oficial = false AND created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_snippets_updated_at
  BEFORE UPDATE ON public.snippets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- ROLE TEMPLATES ----------
CREATE TABLE public.role_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  modulos JSONB NOT NULL DEFAULT '[]'::jsonb,
  menus JSONB NOT NULL DEFAULT '[]'::jsonb,
  oficial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_templates TO authenticated;
GRANT ALL ON public.role_templates TO service_role;
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_templates_read_all_authenticated"
  ON public.role_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_templates_admin_write"
  ON public.role_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- PDF ANEXOS PADRAO ----------
CREATE TABLE public.pdf_anexos_padrao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  escopo TEXT NOT NULL CHECK (escopo IN ('apr','oss','pte','dds','os','rc')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdf_anexos_escopo_ativo ON public.pdf_anexos_padrao(escopo, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_anexos_padrao TO authenticated;
GRANT ALL ON public.pdf_anexos_padrao TO service_role;
ALTER TABLE public.pdf_anexos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_anexos_read_authenticated"
  ON public.pdf_anexos_padrao FOR SELECT TO authenticated USING (true);
CREATE POLICY "pdf_anexos_admin_write"
  ON public.pdf_anexos_padrao FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pdf_anexos_updated_at
  BEFORE UPDATE ON public.pdf_anexos_padrao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- STORAGE POLICIES para bucket pdf-anexos-padrao ----------
-- Bucket é criado via tool supabase--storage_create_bucket.
CREATE POLICY "pdf_anexos_storage_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pdf-anexos-padrao');
CREATE POLICY "pdf_anexos_storage_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pdf-anexos-padrao' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pdf_anexos_storage_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pdf-anexos-padrao' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pdf_anexos_storage_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pdf-anexos-padrao' AND public.has_role(auth.uid(), 'admin'));

-- ---------- SEED: Snippets oficiais ----------
INSERT INTO public.snippets (escopo, campo_alvo, titulo, conteudo, oficial) VALUES
-- APR
('apr','descricao_atividade','Trabalho em altura acima de 2m','Atividade em altura superior a 2 metros com uso obrigatório de cinto de segurança tipo paraquedista, talabarte duplo com absorvedor de energia e ancoragem em ponto certificado (NR-35).', true),
('apr','descricao_atividade','Trabalho a quente (solda/oxicorte)','Serviço a quente com uso de solda elétrica ou oxicorte em área externa, com isolamento, extintor CO2 próximo, biombo e vigia de fogo (NR-34.11).', true),
('apr','descricao_atividade','Espaço confinado - inspeção','Entrada em espaço confinado para inspeção visual, com PET emitida, medição atmosférica prévia (O2, LEL, H2S, CO), vigia externo permanente e comunicação contínua (NR-33).', true),
('apr','medida_controle','Isolamento da área','Isolar a área com cones e fita zebrada em raio mínimo de 3m; sinalizar rotas alternativas; manter pessoas não autorizadas fora do perímetro.', true),
('apr','medida_controle','Bloqueio e etiquetagem (LOTO)','Executar bloqueio da fonte de energia (elétrica/mecânica/hidráulica) com cadeado individual e etiqueta de identificação antes de iniciar a intervenção (NR-12).', true),
('apr','medida_controle','Uso de EPI básico + específico','Uso obrigatório: capacete com jugular, óculos ampla visão, protetor auricular tipo concha, luvas de vaqueta, botina bico composite e uniforme manga longa.', true),
('apr','medida_controle','Vigia permanente','Manter vigia treinado com rádio VHF em posição estratégica durante toda a execução, com autoridade para interromper a atividade em caso de risco.', true),
-- OSS
('oss','descricao_servico','Manutenção corretiva em painel elétrico','Manutenção corretiva em painel elétrico com prévio desenergizamento, teste de ausência de tensão e aterramento temporário (NR-10).', true),
('oss','descricao_servico','Solda em costado da embarcação','Serviço de solda MIG/MAG em chapa de costado com preparação da junta, pré-aquecimento conforme WPS e inspeção visual pelo responsável técnico.', true),
('oss','obrigacoes','Obrigações básicas do executante','1. Manter APR/PET disponível no local; 2. Usar EPI completo durante toda a atividade; 3. Comunicar imediatamente qualquer alteração de risco; 4. Parar o serviço em caso de emergência; 5. Manter área organizada (5S).', true),
('oss','obrigacoes','Descarte de resíduos','Segregar resíduos gerados (metal, tinta, óleo, EPI usado) em recipientes identificados e destinar conforme PGRS. Nunca lançar resíduos ao rio, solo ou lixo comum.', true),
('oss','proibicoes','Proibições operacionais','É PROIBIDO: 1. Executar serviço sem APR/PET válida; 2. Retirar dispositivos de proteção de máquinas; 3. Operar equipamento sem treinamento/autorização; 4. Consumir álcool/drogas antes ou durante o serviço; 5. Improvisar ferramentas ou EPI.', true),
('oss','proibicoes','Bloqueio de acessos','PROIBIDA a permanência de pessoas não envolvidas no serviço dentro da área isolada. PROIBIDO transitar sob cargas suspensas. PROIBIDO fumar em toda a área operacional.', true),
-- INSPECAO
('inspecao','achado','Falta de sinalização de segurança','Ausência de sinalização obrigatória (rotas de fuga, extintores, saída de emergência) conforme NR-26. Item precisa ser regularizado.', true),
('inspecao','achado','EPI em desconformidade','Uso de EPI danificado, vencido ou inadequado para o risco da atividade. Substituição imediata necessária e reforço em treinamento (NR-06).', true),
('inspecao','achado','Extintor com inspeção vencida','Extintor com data de inspeção mensal vencida / lacre rompido / manômetro fora da faixa verde. Substituir e revalidar (NBR 12693 / NR-23).', true),
('inspecao','achado','Ferramenta improvisada / manutenção pendente','Uso de ferramenta manual/elétrica improvisada, sem aterramento, sem proteção ou com defeito visível. Retirar de operação até correção (NR-12).', true),
('inspecao','achado','Área de circulação obstruída','Corredores de circulação ou acesso a equipamentos de emergência (extintor, hidrante, chuveiro/lava-olhos) obstruídos por material/EPI/resíduo (NR-08 / NR-23).', true),
('inspecao','recomendacao','Reforço em treinamento','Realizar reciclagem de treinamento com toda a equipe envolvida, com registro em ata e lista de presença. Prazo sugerido: 15 dias.', true),
('inspecao','recomendacao','Correção imediata + registro','Corrigir a não conformidade imediatamente, registrar evidência fotográfica antes/depois e anexar no plano de ação correspondente.', true),
-- PLANO DE ACAO
('plano_acao','causa_raiz','Falha em treinamento / capacitação','Equipe executante não possuía treinamento formal atualizado no procedimento operacional aplicável à atividade, resultando em execução fora do padrão.', true),
('plano_acao','causa_raiz','Falha em supervisão','Ausência de supervisão de campo no momento da execução da atividade, permitindo desvio do procedimento sem correção imediata.', true),
('plano_acao','causa_raiz','Procedimento inexistente ou desatualizado','O procedimento operacional para a atividade não existia ou estava desatualizado em relação à realidade de execução / normas vigentes.', true),
('plano_acao','acao_corretiva','Revisar procedimento','Revisar e atualizar o procedimento operacional aplicável, incluindo os controles adicionais identificados, e divulgar em DDS para toda a equipe.', true),
('plano_acao','acao_corretiva','Treinamento reciclagem','Executar treinamento de reciclagem com toda a equipe envolvida, com carga horária mínima de 4h, avaliação de aprendizagem e registro em ata.', true),
('plano_acao','acao_corretiva','Auditoria de acompanhamento','Executar auditoria de acompanhamento em campo em até 30 dias para verificar efetividade da ação implementada e registrar evidências.', true),
-- GENERICO
('generico',NULL,'Encerramento padrão','Este documento é válido apenas para a atividade e período descritos. Qualquer alteração de escopo, equipe ou condição ambiental exige nova análise e reemissão.', true),
('generico',NULL,'Ciência da equipe','Declaro que li, entendi e me comprometo a cumprir todas as medidas de controle descritas neste documento, sob pena das medidas disciplinares cabíveis.', true);

-- ---------- SEED: Templates de perfil oficiais ----------
INSERT INTO public.role_templates (nome, descricao, roles, modulos, menus, oficial) VALUES
('TST Pleno','Técnico de Segurança do Trabalho com acesso operacional completo ao SESMT.',
  '["editor"]'::jsonb,
  '["sesmt","estoque"]'::jsonb,
  '[]'::jsonb, true),
('Encarregado de Produção','Encarregado de campo com acesso à produção, manutenção e requisição de compras.',
  '["editor"]'::jsonb,
  '["producao","manutencao","compras"]'::jsonb,
  '[]'::jsonb, true),
('Almoxarife','Responsável pelo almoxarifado, requisições e controle de estoque.',
  '["editor"]'::jsonb,
  '["estoque","compras","almoxarifado"]'::jsonb,
  '[]'::jsonb, true),
('Portaria','Controle de acesso, visitas, veículos e saídas de expediente.',
  '["editor"]'::jsonb,
  '["portaria"]'::jsonb,
  '[]'::jsonb, true),
('Medicina Ocupacional','Equipe de medicina do trabalho: ASO, exames, atestados e convocações.',
  '["editor"]'::jsonb,
  '["sesmt","medicina"]'::jsonb,
  '[]'::jsonb, true),
('Supervisor Geral','Supervisor com visão de aprovação em compras, produção e manutenção. Sem acesso a folha/RH.',
  '["moderador"]'::jsonb,
  '["sesmt","producao","manutencao","compras","estoque","portaria"]'::jsonb,
  '[]'::jsonb, true);