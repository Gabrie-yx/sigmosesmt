-- ============================================================
-- Módulo Compras - Fornecedores Qualificados + Matriz de Score
-- ============================================================

-- 1) Tabela de fornecedores qualificados
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('MATERIAL','SERVICO')),
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  bp TEXT,
  centro_custo TEXT,
  produto TEXT,
  endereco TEXT,
  cnpj TEXT,
  responsavel TEXT,
  email TEXT,
  telefone TEXT,
  estrelas SMALLINT NOT NULL DEFAULT 3 CHECK (estrelas BETWEEN 1 AND 5),
  estrelas_atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estrelas_atualizado_em TIMESTAMPTZ,
  observacoes_avaliacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_tipo ON public.fornecedores(tipo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON public.fornecedores(ativo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON public.fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON public.fornecedores(nome_fantasia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select_authenticated" ON public.fornecedores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fornecedores_insert_compras" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  );

CREATE POLICY "fornecedores_update_compras" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  );

CREATE POLICY "fornecedores_delete_admin" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Extensão da rc_cotacoes com dados do orçamento + score
ALTER TABLE public.rc_cotacoes
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_orcamento TEXT,
  ADD COLUMN IF NOT EXISTS data_orcamento DATE,
  ADD COLUMN IF NOT EXISTS validade DATE,
  ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS frete TEXT,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias SMALLINT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS score_total NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS is_melhor_oferta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ranking SMALLINT,
  ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rc_cotacoes_fornecedor ON public.rc_cotacoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_rc_cotacoes_rc ON public.rc_cotacoes(rc_id);

-- 3) Itens da cotação (mapeados 1:1 com purchase_requisition_items quando possível)
CREATE TABLE IF NOT EXISTS public.rc_cotacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.rc_cotacoes(id) ON DELETE CASCADE,
  rc_item_id UUID REFERENCES public.purchase_requisition_items(id) ON DELETE SET NULL,
  item_numero SMALLINT,
  descricao_ofertada TEXT NOT NULL,
  marca TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  unidade TEXT,
  valor_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  ipi_pct NUMERIC(6,3) DEFAULT 0,
  icms_pct NUMERIC(6,3) DEFAULT 0,
  valor_total NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantidade * valor_unitario, 2)) STORED,
  prazo_entrega_dias SMALLINT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_cotacao_itens_cot ON public.rc_cotacao_itens(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_rc_cotacao_itens_rc_item ON public.rc_cotacao_itens(rc_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rc_cotacao_itens TO authenticated;
GRANT ALL ON public.rc_cotacao_itens TO service_role;

ALTER TABLE public.rc_cotacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_cotacao_itens_select" ON public.rc_cotacao_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rc_cotacao_itens_write" ON public.rc_cotacao_itens
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_gerenciar_compras(auth.uid())
    OR public.is_supervisor_geral(auth.uid())
  );

-- 4) Função para recalcular o valor_total da cotação a partir dos itens
CREATE OR REPLACE FUNCTION public.recalcular_valor_cotacao(_cotacao_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(valor_total), 0) INTO _total
  FROM public.rc_cotacao_itens WHERE cotacao_id = _cotacao_id;

  UPDATE public.rc_cotacoes SET valor = _total WHERE id = _cotacao_id AND _total > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_atualiza_valor_cotacao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recalcular_valor_cotacao(COALESCE(NEW.cotacao_id, OLD.cotacao_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_cotacao_itens_valor ON public.rc_cotacao_itens;
CREATE TRIGGER trg_rc_cotacao_itens_valor
  AFTER INSERT OR UPDATE OR DELETE ON public.rc_cotacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_atualiza_valor_cotacao();

-- 6) MOTOR DE SCORING: Preço 35 + Prazo 20 + Estrelas 25 + Pagamento 10 + Frete 10 = 100
CREATE OR REPLACE FUNCTION public.calcular_scores_rc(_rc_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  _min_valor NUMERIC;
  _min_prazo NUMERIC;
BEGIN
  SELECT MIN(NULLIF(valor,0)) INTO _min_valor FROM public.rc_cotacoes WHERE rc_id = _rc_id;
  SELECT MIN(NULLIF(prazo_entrega_dias,0)) INTO _min_prazo FROM public.rc_cotacoes WHERE rc_id = _rc_id;

  FOR r IN
    SELECT c.id, c.valor, c.prazo_entrega_dias, c.condicao_pagamento, c.frete,
           COALESCE(f.estrelas, 3) AS estrelas
    FROM public.rc_cotacoes c
    LEFT JOIN public.fornecedores f ON f.id = c.fornecedor_id
    WHERE c.rc_id = _rc_id
  LOOP
    DECLARE
      s_preco NUMERIC := 0;
      s_prazo NUMERIC := 0;
      s_estrelas NUMERIC := 0;
      s_pagamento NUMERIC := 0;
      s_frete NUMERIC := 0;
      dias_pgto INT := 30;
      total NUMERIC;
      breakdown JSONB;
    BEGIN
      IF r.valor IS NOT NULL AND r.valor > 0 AND _min_valor IS NOT NULL AND _min_valor > 0 THEN
        s_preco := LEAST(1.0, _min_valor / r.valor) * 35;
      END IF;

      IF r.prazo_entrega_dias IS NOT NULL AND r.prazo_entrega_dias > 0 AND _min_prazo IS NOT NULL AND _min_prazo > 0 THEN
        s_prazo := LEAST(1.0, _min_prazo::NUMERIC / r.prazo_entrega_dias) * 20;
      ELSIF r.prazo_entrega_dias IS NULL AND _min_prazo IS NULL THEN
        s_prazo := 10;
      END IF;

      s_estrelas := (r.estrelas::NUMERIC / 5.0) * 25;

      IF r.condicao_pagamento IS NOT NULL THEN
        SELECT COALESCE(MAX((m[1])::INT),30) INTO dias_pgto
          FROM regexp_matches(r.condicao_pagamento, '([0-9]{1,3})', 'g') AS m;
        s_pagamento := LEAST(1.0, dias_pgto::NUMERIC / 90.0) * 10;
      ELSE
        s_pagamento := 3;
      END IF;

      IF r.frete IS NOT NULL AND UPPER(r.frete) LIKE '%CIF%' THEN
        s_frete := 10;
      ELSIF r.frete IS NOT NULL AND UPPER(r.frete) LIKE '%FOB%' THEN
        s_frete := 4;
      ELSE
        s_frete := 5;
      END IF;

      total := ROUND(s_preco + s_prazo + s_estrelas + s_pagamento + s_frete, 2);
      breakdown := jsonb_build_object(
        'preco', ROUND(s_preco,2),
        'prazo_entrega', ROUND(s_prazo,2),
        'estrelas', ROUND(s_estrelas,2),
        'condicao_pagamento', ROUND(s_pagamento,2),
        'frete', ROUND(s_frete,2),
        'estrelas_fornecedor', r.estrelas,
        'dias_pagamento_detectado', dias_pgto
      );

      UPDATE public.rc_cotacoes
         SET score_total = total, score_breakdown = breakdown, analisado_em = now()
       WHERE id = r.id;
    END;
  END LOOP;

  UPDATE public.rc_cotacoes SET is_melhor_oferta = false, ranking = NULL WHERE rc_id = _rc_id;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY score_total DESC NULLS LAST, valor ASC NULLS LAST) AS rk
    FROM public.rc_cotacoes WHERE rc_id = _rc_id
  )
  UPDATE public.rc_cotacoes c
     SET ranking = ranked.rk::SMALLINT, is_melhor_oferta = (ranked.rk = 1)
    FROM ranked WHERE ranked.id = c.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_scores_rc(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalcular_valor_cotacao(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_rc_cotacoes_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.calcular_scores_rc(COALESCE(NEW.rc_id, OLD.rc_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_cotacoes_after_change ON public.rc_cotacoes;
CREATE TRIGGER trg_rc_cotacoes_after_change
  AFTER INSERT OR UPDATE OF valor, prazo_entrega_dias, condicao_pagamento, frete, fornecedor_id OR DELETE ON public.rc_cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_rc_cotacoes_score();

-- 8) Seed dos 47 fornecedores qualificados
INSERT INTO public.fornecedores (tipo, nome_fantasia, razao_social, bp, centro_custo, produto, endereco, cnpj, responsavel, email, telefone) VALUES
('MATERIAL','AMAZON AÇO','AMAZON AÇO INDUSTRIA','1185/1910','Montagem','Chapa cortada de Aço','Av. Puraquequera nº 5328 - Puraquequera - Manaus - AM','05.477.207/0001-75','Leonardo/Darlison','amazonaco@amazonaco.com.br','(92) 2129-9898'),
('MATERIAL','WHITE MARTINS','WHITE MARTINS GASES','19471','Montagem/Soldagem','Oxigênio e CO2','Av. Autaz Mirim, 1053 Distrito Industrial - Manaus - Am','34.597.955/0004-32','Luciano','luciano.ferreira@linde.com/atendimento@sacwhitemartins.com.br','(92) 98428-2764'),
('MATERIAL','L PALHETA','L PALHETA BATISTA','21373','Montagem','GLP','Rua Brasil, 127 - Letra B Educanos - Manaus - AM','49.869.743/0001-91','Leandro','LEANDROPBATISTA1@GMAIL.COM','(92) 99962-3123'),
('MATERIAL','CARBOMAN','CARBOMAN - GAS CARBONICO','6174','Soldagem','CO2','AV. Torquato Tapajos, 5558 - Colonia Terra Nova - Manaus - Am','63.634.596/0001-00','Clefeson','tributariogs@gruposimoes.com.br','(92) 98621-0615'),
('MATERIAL','ESAB','ESAB INDUSTRIA E COMERCIO','6147','Montagem/Soldagem','ELETRODO E ARAME TUBOLAR','Rua Arthur Barbarini, 967 - Centro Emp. Indaiatuba - Indaiatuba - SP','29.799.921/0003-00','Natan','natan.filho@esab.com.br','(92) 98151-9164'),
('MATERIAL','DENVER','DENVER SOLDAS SA','13286','Montagem/Soldagem','ELETRODO E ARAME TUBOLAR','Av. Governador Magalhaes Pinhto, 3433 - Planalto - Monte Claros - MG','22.671.564/0001-99','Randerson','contab.bh@denver.com.br','(92) 99152-7429'),
('MATERIAL','AMAZON','AMAZON COMBUSTIVEIS','181','Transporte Interno','OLEO DIESEL B S500','Av. Andre Araujo, 763 Aleixo - Manaus - AM','10.988.014/0015-14','Iel','fiscal@postosatem.com.br','(92) 98110-1011'),
('MATERIAL','AKZO NOBEL','AKZO NOBEL LTDA','1992','Pintura','TINTAS/SOLVENTES','Av. Dos Estados, 4826, Bloco a Utinga - Santo Andre - SP','60.561.719/0097-75','Hudson','brasiltds@akzonobel.com','(21) 99184-9468'),
('MATERIAL','CASA DAS TINTAS','CASA DAS TINTAS DISTRIBUIDORA','3056','Pintura','TINTA/THINNER','Av. Alvaro Maia, 276 - Centro - Manaus - AM','04.338.273/0001-00','Junior','ctvendas@hotmail.com','(92) 99189-1775'),
('MATERIAL','CONSTREL','H F R ALBUQUERQUE & CIA LTDA','3208','Pintura','TINTA/THINNER','Av. Tarumã, 1698 lado A/B Praça 14 de Janeiro - Manaus - AM','34.561.795/0001-29','Janilson',NULL,'(92) 99231-7011'),
('MATERIAL','SÃO FRANCISCO','MARCOS A BEZERRA LTDA','6111','Transporte Interno/Manutenção','OLEO LUBRIFICANTE','Av. Castelo Branco, 272 Cachoeirinha - Manaus - AM','04.968.129/0002-20','JAQUELINE',NULL,'(92) 3233-8558'),
('MATERIAL','MAQMOTO','MAQMOTO MAQUINAS E MOTORES','3072','Montagem','MOTOR/BOMBA','Av. Carvalho Leal, 1615 - Cachoeirinha - Manaus - AM','05.460.431/0001-54','Vitor',NULL,'(92) 98139-3400'),
('MATERIAL','MOTONORTE','MOTONORTE MOTORES E MAQUINAS (BP 5066)','5066','montagem','MOTOR MARITIMO (YANMAR)','Rua Miranda Leão, 411 - Centro - Manaus - AM','05.447.263/0003-29','Melo',NULL,'(92) 99388-5494'),
('MATERIAL','VETOH','VETOH MAT DE EQUIP DE SEG TRAB LTDA','3088','Transporte Interno/Manutenção','CONEXÃO EM GERAL','Av. Tefe, 229 - Raiz - Manaus - AM','07.006.369/0001-50','MAURO',NULL,'98176-0652'),
('MATERIAL','OXIMIG','OXIMIG IND E COM LTDA','22136','Montagem/Soldagem','Manometro/Acessorios Tocha Mig','Rua Desembargador Gaspar Guimarâes, 119 - Loja União - P10 - Manaus - AM','51.568.921/0002-77','Milton',NULL,'(92) 99219-3754'),
('MATERIAL','TUBO AÇO','TUBOAÇOS DA AMAZONIA LTDA','3068','Montagem','TUBOS E CONEXÕES','Av. Tefé, 2837 - Japiim - Manaus - AM','05.236.056/0001-63','Joice',NULL,'(92) 99492-9907'),
('MATERIAL','AÇO MANAUS','AÇO MANAUS IND E COM DE FERRO E AÇO LTDA','1762','Montagem','Chapas e Perfil','Av. Bom Jesus, 121 - Colônia Terra Nova - Manaus - AM','11.174.512/0002-71','Juliana',NULL,'(92) 98264-2251'),
('MATERIAL','ESPLANADAS','INDUSTRIAS ESPLANADAS LTDA','5059','Montagem','Perfil/nomes e calados/escotilhas','Rua Magalhaes Barata, 45 Crespo - Manaus - AM','04.534.459/0001-26','Vieira Jr',NULL,'(92) 98426-0358'),
('MATERIAL','LUANJO','IMPORTADORA LUANJO LTDA','5056','Montagem/Soldagem','KIT SOPEP','Av. Leopoldo Peres, 305 - Educanos - Manuas - AM','04.223.160/0001-50','Josue',NULL,'(92) 3624-4588'),
('MATERIAL','CASA DAS CORREIAS','L J GUERRA E CIA LTDA','3062','Montagem','CONEXÃO EM GERAL','Av. Rodrigo Otavio, 4050 - Japiim - Manaus - AM','04.501.136/0001-36','Raimundo',NULL,'9340-9102'),
('MATERIAL','INFINITY','INFINITY COMERCIO DE PEÇAS ACESSORIOS','8041','Montagem','VALVULAS PRESSÃO E VACUO/ALARME DE NIVEL','Rua Professora Ursula Monteiro, 117 - Lote Paraiso Tropical sala 3 - Tarumã - Manaus - AM','16.896.872-0001-10','PEDRO',NULL,'8415-9030'),
('MATERIAL','BI - LED','BI LED LTDA','1917','Montagem','CONDULETE','Rua Augusto Maia, 70 - Vila Galvão - Guarulhos - SP','28.904.351/0001-46','RODRIGO',NULL,'(11) 99780-5156'),
('MATERIAL','MAG PEÇAS','MAG PEÇAS E SERV DE MOT MARITIMOS','5073','Montagem','Silecioso e flexivel','Av. Humaita nº 465 A, 465 - Cachoeirinha - Manaus - AM','06.122.036/0001-24',NULL,NULL,NULL),
('MATERIAL','TRADICION','TRADICION COMERCIO IMP E EXP LTDA','6137','Montagem/Transporte Interno','VISOR DE NIVEL/CINTAS/MANILHAS','Rua Dr. Machado, 151 Centro - Manaus - AM','00.682.978/0001-80','ELOISA',NULL,'(92) 3635-6508'),
('MATERIAL','SV INSTALAÇÕES','SV INSTALAÇÕES LTDA','3246','Montagem/Manutenção','CABOS/DISJUNTORES','Av. Cosme Ferreira, 2116 - Coroado - Manaus - AM','84.089.358/0001-22','ANDRÉ SOARES',NULL,'(92) 2123-4411'),
('MATERIAL','VEMAP','VEMAP COMERCIO DE VEICULOS MAQUINAS E PEÇAS LTDA','6585','Transporte Interno','SENSOR/FAROL/CHAVE GERAL','Av. Max Teixeira, 1057 - Colonia Sto Antonio - Manaus - AM','04.894.544/0001-03','YASMIN',NULL,'(92) 3651-6000'),
('MATERIAL','POLIFILTRO','POLIFILTRO IND E COM DE PEÇAS','5162','Transporte Interno','FILTROS EM GERAL/GRAXA/OLEO HIDRAULICO','Av. São Jorge, 3162 - São Jorge - Manaus - AM','60.700.135/0004-34','GERALDA',NULL,'(92) 3343-5830'),
('MATERIAL','JAPURA PNEUS','JAPURA PNEUS LTDA','6142/8662','Transporte Interno','PNEUS/CAMARA DE AR','Av. Silves, 39 Cachoeirinha - Manaus - AM','04.214.987/0003-60','MARCIA',NULL,'(92) 3642-1313'),
('MATERIAL','FC COMERCIO','FC COMERCIO DE FERRAGENS LTDA','6106','Transporte Interno/Manutenção/Montagem','TERMOMETRO/MANGUEIRA HIDRAULICA/GOZO','Av. Autaz mirim, 10069 - Cidade de Deus - Manaus - AM','12.069.192/0001-71','JOÃO PEDRO',NULL,'(92) 99478-9555'),
('SERVICO','A F REPARAÇÃO','A F REPARACAO E CONSTRUCAO NAVAL','7375.0','Montagem','SOLDAGEM E MONTAGEM','Consagração, 129 - Colonia Oliveira Machado - Manaus - AM','41.295.394/0001-30','ALEX','contabil.akc@outlook.com',NULL),
('SERVICO','NB CONSTRUÇÃO NAVAL','MARCIO CRUZ DA COSTA','7002.0','Montagem','SOLDAGEM E MONTAGEM','Rua das Garças, 12 Quadra 20 - Fazendinha - Cidade de Deus - Manaus - Am','23.036.690/0001-34','MARCIO','contabil.akc@outlook.com','(92) 99203-9349'),
('SERVICO','ED SERVIÇOS E MANUTENÇÃO','EDVALDO ALVES DE SOUZA','6158.0','Pintura','PINTURA E JATEAMENTO','Rua Terra Preta, 533 - São José Operário - Manaus - AM','05.562.265/0001-05','EDVALDO','edservicos2013@hotmail.com','(92) 99207-2706'),
('SERVICO','E R CONTRUÇÃO','E R CONSTRUÇÃO NAVAL LTDA','25765.0','Montagem','SOLDAGEM E MONTAGEM','Rua Mandaguari, 60 - Conj. Nova Luz - Zumbi dos Palmares - Manaus - Am','59.882.458/0001-64','ELIEZIO','elieziorodrigues232@gmail.com','(92) 99430-0335'),
('SERVICO','JCS GALVÃO CONTRUÇÃO','J C S CONSTRUCAO NAVAL LTDA (BP 22562)','22562.0','Soldagem','SOLDAGEM E MONTAGEM','Rua Itauna, 102 - Qd D26 LT 4 Loteamento - Manaus - AM','54.761.547/0001-39','JOSE CARLOS','zecarlos.chp@gmail.com','(92) 99430-0335'),
('SERVICO','S P CAMPOS','S P CAMPOS','6284.0',NULL,'ISOLAMENTO TERMICO','Itaborai, 39 - Novo Aleixo - Manaus - Amazonas','39.583.239/0001-77','LEMOS','suzanacampos@live.com',NULL),
('SERVICO','RAY CONNIFF','RAY CONNIFF MATOS DE CASTRO','5899.0',NULL,'PINTURA E IDENTIFICAÇÃO','Rua Carlos Dias, 55 - Crespo - Manaus - AM','35.443.460/0001-79','RAY CONNIFF','kalelrayletreiros@gmail.com',NULL),
('SERVICO','RGF TECNOLOGIA NAVAL','RGF TECN. CONSULT.E ASSESS. NAVAL','6163.0','Apoio Operacional','ELABORAÇÃO DE PROJETOS','Av. Alvaro Maia, 440 - Edif. Floriano Albuquerque sala 105 - Centro - Manaus - AM','09.255.547/0001-02','RICARDO','feroli_kid@hotmail.com',NULL),
('SERVICO','RBNA SOCIEDADE CLASSIFICADORA','REGISTRO BRASILEIRO DE NAVIOS E ERA','12800.0',NULL,'ANALISE TECNICA','Rua Mexico 11, andar 8 sala 1 a 11 - Centro - Rio de Janeiro - RJ','27.908.151/0001-07',NULL,'laranja@rbna.org.br',NULL),
('SERVICO','AUTO SHIP','AUTO SHIP CERTIFICADORA DE EMBARCAÇÃO','5081.0',NULL,'CERTIFICADORA','Rua Teolino José Correia 306B - Centro Santopolis do Guaapei - SP','08.333.414/0001-44',NULL,'contabilidade@autoship.com.br',NULL),
('SERVICO','LEGADO MANUTENÇÃO','LF SERVIÇOS E MANUTENÇÃO LTDA','12763.0','Transporte Interno','MANUTENÇÃO MAQUINAS PESADAS','Des. Gaspar Guimarães, 233 - P10 - Manaus - AM','43.042.828/0001-15','BATALHA','mcontass@gmail.com','(92) 99435-9004'),
('SERVICO','EZ DESENVOLVIMENTO INDUSTRIAL','A. DE SOUZA PEREIRA FILHO','28172.0','Montagem','SOLDAGEM E MONTAGEM','Rua Planaltina, nº 16 - Lirio do Vale','64.352.607/0001-13','ADELSON e EVELYN','desenvolvimentoez@hotmail.com','(92) 98490-2727'),
('SERVICO','AMBIENTEK SANEAMENTO LTDA','AMBIENTEK SANEAMENTO LTDA','8145.0','Administração','SANEAMENTO E CONTROLE DE PRAGAS','Rua Severiano Nunes, 216  Aleixo','34.375.080/0001-81','ROSANGELA','consultora02@ambientek.com.br','(92) 99182-4860'),
('SERVICO','SALINAV LTDA','SALINAV LTDA','27308.0','Montagem','SOLDAGEM E MONTAGEM','Rua Padre Mario, 1470, Colonia Antonio Aleixo','52.106.772/0001-06','CARLOS','saldanha.salinav@gmail.com','(92) 99251-1677'),
('SERVICO','METALURGIA MAGALHÃES','ICM INDUSTRIA E COMERCIO DE METAIS LTDA','28222.0','Montagem','SOLDAGEM E MONTAGEM','Av. Rodrigo otávio, nº 5459 - Japiim','26.334.009/0001-22','DARIANE','moutinhodariane531@gmail.com','(92) 98288-9414'),
('SERVICO','M2 CONSTRUTORA COMERCIO E SERVICOS','M2 CONSTRUTORA E SERVIÇOS LTDA','28638.0','Montagem','SOLDAGEM E MONTAGEM','Rod BR 316, nº 1762 4º andar sala 406, Atalaia - Ananindeua -PA','19.766.368/0001-93','FELIPE','m2ctservicos@gmail.com','(93) 99218-7006'),
('SERVICO','INTEGRAL OCUPACIONAL DA AMAZONIA LTDA','INTEGRAL OCUPACIONAL DA AMAZONIA LTDA','6170.0','Administração','SERVIÇO DE MEDICINA OCUPAIONAL','Rua Comendador Clementino, nº 219 Centro','02.145.060/0001-28','MARIA DO CARMO','financeiro@integralocupacional.com.br','(92) 99136-2239'),
('SERVICO','EMOPS CONTROLE AMBIENTAL LTDA','EMOPS CONTROLE AMBIENTAL LTDA','3090.0','Administração','SANEAMENTO E CONTROLE DE PRAGAS','Av. Constantino Nery, nº 1771  São Geraldo','08.014.539/0001-01','DANIELA','danielle@emops.com.br','(92) 99303-9657');

DELETE FROM public.fornecedores a USING public.fornecedores b
WHERE a.cnpj = b.cnpj AND a.cnpj IS NOT NULL AND a.created_at > b.created_at;