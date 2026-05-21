-- =========================================
-- EQUIPAMENTOS MÓVEIS (frota)
-- =========================================
CREATE TABLE public.equipamentos_moveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- PA_CARREGADEIRA | GUINDASTE | COMPRESSOR | DRAGA | GUINCHO | ESCAVADEIRA | MUNCK | OUTRO
  fabricante TEXT,
  modelo TEXT,
  ano INTEGER,
  numero_serie TEXT,
  numero_patrimonio TEXT,
  horimetro_atual NUMERIC DEFAULT 0,
  empresa_responsavel_id UUID,
  status TEXT NOT NULL DEFAULT 'ATIVO', -- ATIVO | MANUTENCAO | INATIVO
  foto_path TEXT,
  observacoes TEXT,
  modelo_checklist_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX idx_equip_tipo ON public.equipamentos_moveis(tipo);
CREATE INDEX idx_equip_status ON public.equipamentos_moveis(status);

ALTER TABLE public.equipamentos_moveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY em_select ON public.equipamentos_moveis FOR SELECT TO authenticated USING (true);
CREATE POLICY em_insert ON public.equipamentos_moveis FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY em_update ON public.equipamentos_moveis FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY em_delete ON public.equipamentos_moveis FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_em_updated BEFORE UPDATE ON public.equipamentos_moveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CHECKLIST MODELOS (templates DMN)
-- =========================================
CREATE TABLE public.checklist_modelos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE, -- FOR-M-MEC 01, 02, 06
  nome TEXT NOT NULL,
  tipo_equipamento TEXT NOT NULL, -- PA_CARREGADEIRA | GUINDASTE | COMPRESSOR_DRAGA_GUINCHO
  revisao TEXT DEFAULT '01',
  data_revisao DATE DEFAULT '2026-05-06',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cm_select ON public.checklist_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY cm_insert ON public.checklist_modelos FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cm_update ON public.checklist_modelos FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cm_delete ON public.checklist_modelos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- CHECKLIST MODELO SECOES
-- =========================================
CREATE TABLE public.checklist_modelo_secoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id UUID NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL, -- 1, 2, 3...
  titulo TEXT NOT NULL,
  subgrupo TEXT, -- pra FOR-M-MEC 06: COMPRESSOR | DRAGA | GUINCHO
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cms_modelo ON public.checklist_modelo_secoes(modelo_id, ordem);
ALTER TABLE public.checklist_modelo_secoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cms_select ON public.checklist_modelo_secoes FOR SELECT TO authenticated USING (true);
CREATE POLICY cms_insert ON public.checklist_modelo_secoes FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cms_update ON public.checklist_modelo_secoes FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cms_delete ON public.checklist_modelo_secoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- CHECKLIST MODELO ITENS
-- =========================================
CREATE TABLE public.checklist_modelo_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secao_id UUID NOT NULL REFERENCES public.checklist_modelo_secoes(id) ON DELETE CASCADE,
  numero TEXT NOT NULL, -- "1.1", "1.2", "2.1"
  descricao TEXT NOT NULL,
  criticidade TEXT NOT NULL DEFAULT 'MEDIA', -- BAIXA | MEDIA | ALTA
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cmi_secao ON public.checklist_modelo_itens(secao_id, ordem);
ALTER TABLE public.checklist_modelo_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY cmi_select ON public.checklist_modelo_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY cmi_insert ON public.checklist_modelo_itens FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cmi_update ON public.checklist_modelo_itens FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cmi_delete ON public.checklist_modelo_itens FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- CHECKLIST EXECUCOES (1 por dia por equipamento)
-- =========================================
CREATE TABLE public.checklist_execucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos_moveis(id) ON DELETE CASCADE,
  modelo_id UUID NOT NULL REFERENCES public.checklist_modelos(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horimetro_inicial NUMERIC,
  horimetro_final NUMERIC,
  operador_id UUID, -- employee_id
  operador_nome TEXT,
  mecanico_id UUID,
  mecanico_nome TEXT,
  encarregado_id UUID,
  encarregado_nome TEXT,
  status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO', -- EM_ANDAMENTO | CONFORME | COM_NC
  total_itens INTEGER DEFAULT 0,
  total_ok INTEGER DEFAULT 0,
  total_nc INTEGER DEFAULT 0,
  total_na INTEGER DEFAULT 0,
  assinatura_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(equipamento_id, data)
);
CREATE INDEX idx_ce_equip_data ON public.checklist_execucoes(equipamento_id, data DESC);
CREATE INDEX idx_ce_data ON public.checklist_execucoes(data DESC);
ALTER TABLE public.checklist_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ce_select ON public.checklist_execucoes FOR SELECT TO authenticated USING (true);
CREATE POLICY ce_insert ON public.checklist_execucoes FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY ce_update ON public.checklist_execucoes FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY ce_delete ON public.checklist_execucoes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ce_updated BEFORE UPDATE ON public.checklist_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CHECKLIST RESPOSTAS (1 por item por execução)
-- =========================================
CREATE TABLE public.checklist_respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execucao_id UUID NOT NULL REFERENCES public.checklist_execucoes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.checklist_modelo_itens(id),
  resposta TEXT NOT NULL, -- OK | NC | NA
  observacao TEXT,
  os_numero TEXT,
  foto_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(execucao_id, item_id)
);
CREATE INDEX idx_cr_execucao ON public.checklist_respostas(execucao_id);
CREATE INDEX idx_cr_resposta ON public.checklist_respostas(resposta);
ALTER TABLE public.checklist_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_select ON public.checklist_respostas FOR SELECT TO authenticated USING (true);
CREATE POLICY cr_insert ON public.checklist_respostas FOR INSERT TO authenticated WITH CHECK (is_editor(auth.uid()));
CREATE POLICY cr_update ON public.checklist_respostas FOR UPDATE TO authenticated USING (is_editor(auth.uid()));
CREATE POLICY cr_delete ON public.checklist_respostas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- STORAGE BUCKET para fotos/assinaturas
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklists-equipamentos', 'checklists-equipamentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "checklists_equip_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklists-equipamentos');
CREATE POLICY "checklists_equip_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklists-equipamentos');
CREATE POLICY "checklists_equip_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklists-equipamentos');
CREATE POLICY "checklists_equip_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklists-equipamentos' AND has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- SEED — FOR-M-MEC 01 (PÁ CARREGADEIRA)
-- =========================================
DO $$
DECLARE
  v_modelo_id UUID;
  v_secao_id UUID;
BEGIN
  INSERT INTO public.checklist_modelos (codigo, nome, tipo_equipamento)
  VALUES ('FOR-M-MEC 01', 'Checklist Diário — Pá Carregadeira', 'PA_CARREGADEIRA')
  RETURNING id INTO v_modelo_id;

  -- Seção 1: ACESSÓRIOS
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 1, 'ACESSÓRIOS', 1) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '1.1', 'Conchas, Pinos e Travas', 'ALTA', 1),
    (v_secao_id, '1.2', 'Pneus', 'ALTA', 2),
    (v_secao_id, '1.3', 'Espelhos Retrovisores', 'MEDIA', 3),
    (v_secao_id, '1.4', 'Buzina', 'MEDIA', 4),
    (v_secao_id, '1.5', 'Alarme sonoro de ré', 'ALTA', 5);

  -- Seção 2: SISTEMA DE FREIO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 2, 'SISTEMA DE FREIO', 2) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '2.1', 'Freios de serviço', 'ALTA', 1),
    (v_secao_id, '2.2', 'Freios de estacionamento', 'ALTA', 2),
    (v_secao_id, '2.3', 'Pressão dos Pneus', 'MEDIA', 3);

  -- Seção 3: SISTEMA HIDRÁULICO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 3, 'SISTEMA HIDRÁULICO', 3) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '3.1', 'Mangueiras e correias', 'ALTA', 1),
    (v_secao_id, '3.2', 'Cilindros Hidráulicos', 'ALTA', 2),
    (v_secao_id, '3.3', 'Válvulas e conexões', 'MEDIA', 3);

  -- Seção 4: SISTEMA DE IGNIÇÃO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 4, 'SISTEMA DE IGNIÇÃO', 4) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '4.1', 'Chave Geral', 'ALTA', 1),
    (v_secao_id, '4.2', 'Chave de ignição', 'ALTA', 2);

  -- Seção 5: LUZES
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 5, 'LUZES', 5) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '5.1', 'Faróis e luminárias', 'MEDIA', 1),
    (v_secao_id, '5.2', 'Setas', 'MEDIA', 2),
    (v_secao_id, '5.3', 'Emergência (Pisca Alerta)', 'MEDIA', 3);

  -- Seção 6: MOTOR
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 6, 'MOTOR', 6) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '6.1', 'Abastecimento de combustível', 'MEDIA', 1),
    (v_secao_id, '6.2', 'Marcador de combustível', 'BAIXA', 2),
    (v_secao_id, '6.3', 'Filtro do combustível', 'MEDIA', 3),
    (v_secao_id, '6.4', 'Nível de óleo hidráulico', 'ALTA', 4),
    (v_secao_id, '6.5', 'Nível de óleo do motor', 'ALTA', 5),
    (v_secao_id, '6.6', 'Nível de água do radiador', 'ALTA', 6),
    (v_secao_id, '6.7', 'Filtro de ar', 'MEDIA', 7),
    (v_secao_id, '6.8', 'Bateria', 'MEDIA', 8),
    (v_secao_id, '6.9', 'Correias', 'MEDIA', 9),
    (v_secao_id, '6.10', 'Vazamentos do motor', 'ALTA', 10);
END $$;

-- =========================================
-- SEED — FOR-M-MEC 02 (GUINDASTE GROVE)
-- =========================================
DO $$
DECLARE
  v_modelo_id UUID;
  v_secao_id UUID;
BEGIN
  INSERT INTO public.checklist_modelos (codigo, nome, tipo_equipamento)
  VALUES ('FOR-M-MEC 02', 'Checklist Diário — Guindaste Grove', 'GUINDASTE')
  RETURNING id INTO v_modelo_id;

  -- Seção 1: CONDIÇÕES EXTERNAS
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 1, 'CONDIÇÕES EXTERNAS', 1) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '1.1', 'Bateria', 'MEDIA', 1),
    (v_secao_id, '1.2', 'Fim de curso do guincho principal', 'ALTA', 2),
    (v_secao_id, '1.3', 'Fim de curso do guincho auxiliar', 'ALTA', 3),
    (v_secao_id, '1.4', 'Fim de curso do tambor auxiliar', 'ALTA', 4),
    (v_secao_id, '1.5', 'Para-brisa da cabine de operação', 'MEDIA', 5),
    (v_secao_id, '1.6', 'Limpador de para-brisa da cabine de operação', 'BAIXA', 6),
    (v_secao_id, '1.7', 'Cabo principal', 'ALTA', 7),
    (v_secao_id, '1.8', 'Cabo auxiliar', 'ALTA', 8),
    (v_secao_id, '1.9', 'Clip do cabo principal', 'ALTA', 9),
    (v_secao_id, '1.10', 'Clip do cabo auxiliar', 'ALTA', 10);

  -- Seção 2: IÇAMENTO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 2, 'IÇAMENTO', 2) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '2.1', 'Cinta de elevação', 'ALTA', 1),
    (v_secao_id, '2.2', 'Cinta de catraca', 'ALTA', 2),
    (v_secao_id, '2.3', 'Manilha', 'ALTA', 3),
    (v_secao_id, '2.4', 'Gancho', 'ALTA', 4),
    (v_secao_id, '2.5', 'Cabo guia', 'MEDIA', 5),
    (v_secao_id, '2.6', 'Quebra canto', 'MEDIA', 6);

  -- Seção 3: VAZAMENTOS EXTERNOS
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 3, 'POSSÍVEIS VAZAMENTOS EXTERNOS', 3) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '3.1', 'Cilindro de lança', 'ALTA', 1),
    (v_secao_id, '3.2', 'Cilindro de patolas', 'ALTA', 2),
    (v_secao_id, '3.3', 'Mangueiras', 'ALTA', 3),
    (v_secao_id, '3.4', 'Tubulações', 'MEDIA', 4),
    (v_secao_id, '3.5', 'Conexões', 'MEDIA', 5),
    (v_secao_id, '3.6', 'Radiador', 'MEDIA', 6);

  -- Seção 4: SEGURANÇA
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 4, 'SEGURANÇA', 4) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '4.1', 'Cinto (rasgado / fivela quebrada)', 'ALTA', 1),
    (v_secao_id, '4.2', 'Alarme de ré', 'ALTA', 2),
    (v_secao_id, '4.3', 'Nível de bolhas', 'MEDIA', 3),
    (v_secao_id, '4.4', 'Extintores', 'ALTA', 4),
    (v_secao_id, '4.5', 'Pneu step', 'BAIXA', 5);

  -- Seção 5: CONDIÇÕES INTERNAS
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 5, 'CONDIÇÕES INTERNAS', 5) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '5.1', 'Manual do veículo', 'BAIXA', 1),
    (v_secao_id, '5.2', 'Buzina', 'MEDIA', 2),
    (v_secao_id, '5.3', 'Painel de instrumentos', 'MEDIA', 3),
    (v_secao_id, '5.4', 'Funcionamento do ar condicionado', 'BAIXA', 4),
    (v_secao_id, '5.5', 'Quebra-sol da cabine de operação', 'BAIXA', 5),
    (v_secao_id, '5.6', 'Quebra-sol da cabine do cavalo mecânico', 'BAIXA', 6),
    (v_secao_id, '5.7', 'Iluminação interna', 'BAIXA', 7),
    (v_secao_id, '5.8', 'Bancos', 'BAIXA', 8),
    (v_secao_id, '5.9', 'Tapetes', 'BAIXA', 9),
    (v_secao_id, '5.10', 'Maçanetas', 'BAIXA', 10),
    (v_secao_id, '5.11', 'Vidros', 'BAIXA', 11),
    (v_secao_id, '5.12', 'Limpeza interna', 'BAIXA', 12),
    (v_secao_id, '5.13', 'Retrovisores', 'MEDIA', 13),
    (v_secao_id, '5.14', 'Para-brisas', 'MEDIA', 14);

  -- Seção 6: CONTROLES
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, ordem)
  VALUES (v_modelo_id, 6, 'CONTROLES', 6) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '6.1', 'Freio de serviço', 'ALTA', 1),
    (v_secao_id, '6.2', 'Freio de mão', 'ALTA', 2),
    (v_secao_id, '6.3', 'Fluído do radiador', 'MEDIA', 3),
    (v_secao_id, '6.4', 'Nível de óleo hidráulico', 'ALTA', 4),
    (v_secao_id, '6.5', 'Nível de óleo do motor', 'ALTA', 5),
    (v_secao_id, '6.6', 'Combustível', 'MEDIA', 6),
    (v_secao_id, '6.7', 'Embreagem', 'ALTA', 7),
    (v_secao_id, '6.8', 'Acelerador', 'ALTA', 8),
    (v_secao_id, '6.9', 'Limitador de carga (LMI)', 'ALTA', 9),
    (v_secao_id, '6.10', 'Tabela de carga', 'ALTA', 10);
END $$;

-- =========================================
-- SEED — FOR-M-MEC 06 (COMPRESSOR / DRAGA / GUINCHO)
-- =========================================
DO $$
DECLARE
  v_modelo_id UUID;
  v_secao_id UUID;
BEGIN
  INSERT INTO public.checklist_modelos (codigo, nome, tipo_equipamento)
  VALUES ('FOR-M-MEC 06', 'Checklist Diário — Compressor / Draga / Guincho', 'COMPRESSOR_DRAGA_GUINCHO')
  RETURNING id INTO v_modelo_id;

  -- Subgrupo COMPRESSOR ATLAS COPCO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, subgrupo, ordem)
  VALUES (v_modelo_id, 1, 'ACESSÓRIOS', 'COMPRESSOR', 1) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '1.1', 'Nível de óleo do motor', 'ALTA', 1),
    (v_secao_id, '1.2', 'Nível de água do radiador', 'ALTA', 2),
    (v_secao_id, '1.3', 'Nível de óleo hidráulico', 'ALTA', 3),
    (v_secao_id, '1.4', 'Filtro de óleo diesel', 'MEDIA', 4),
    (v_secao_id, '1.5', 'Filtro de ar do motor', 'MEDIA', 5),
    (v_secao_id, '1.6', 'Verificação das mangueiras', 'ALTA', 6),
    (v_secao_id, '1.7', 'Verificação do filtro de ar', 'MEDIA', 7),
    (v_secao_id, '1.8', 'Vazamento do motor', 'ALTA', 8);

  -- Subgrupo DRAGA DE APOIO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, subgrupo, ordem)
  VALUES (v_modelo_id, 2, 'ACESSÓRIOS', 'DRAGA', 2) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '2.1', 'Nível de óleo do motor', 'ALTA', 1),
    (v_secao_id, '2.2', 'Nível de água do radiador', 'ALTA', 2),
    (v_secao_id, '2.3', 'Filtro de ar do motor', 'MEDIA', 3),
    (v_secao_id, '2.4', 'Verificar mangueiras', 'ALTA', 4);

  -- Subgrupo GUINCHO ESTACIONÁRIO
  INSERT INTO public.checklist_modelo_secoes (modelo_id, numero, titulo, subgrupo, ordem)
  VALUES (v_modelo_id, 3, 'ACESSÓRIOS', 'GUINCHO', 3) RETURNING id INTO v_secao_id;
  INSERT INTO public.checklist_modelo_itens (secao_id, numero, descricao, criticidade, ordem) VALUES
    (v_secao_id, '3.1', 'Nível de óleo hidráulico', 'ALTA', 1),
    (v_secao_id, '3.2', 'Verificação de mangueiras', 'ALTA', 2),
    (v_secao_id, '3.3', 'Lubrificação', 'MEDIA', 3);
END $$;

-- =========================================
-- TRIGGER: ao finalizar execução COM_NC, gera NC automática
-- =========================================
CREATE OR REPLACE FUNCTION public.gerar_nc_de_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equip RECORD;
  v_item RECORD;
  v_titulo TEXT;
  v_desc TEXT;
BEGIN
  -- Só dispara quando status muda para COM_NC
  IF NEW.status = 'COM_NC' AND (OLD.status IS DISTINCT FROM 'COM_NC') THEN
    SELECT * INTO v_equip FROM public.equipamentos_moveis WHERE id = NEW.equipamento_id;

    -- Para cada resposta NC, cria 1 NC
    FOR v_item IN
      SELECT r.id AS resp_id, r.observacao, i.numero, i.descricao, i.criticidade
      FROM public.checklist_respostas r
      JOIN public.checklist_modelo_itens i ON i.id = r.item_id
      WHERE r.execucao_id = NEW.id AND r.resposta = 'NC'
    LOOP
      v_titulo := 'Checklist ' || COALESCE(v_equip.tag, '?') || ' — ' || v_item.numero || ' ' || v_item.descricao;
      v_desc := 'NC identificada em checklist diário do equipamento ' || COALESCE(v_equip.nome, v_equip.tag) ||
                ' em ' || to_char(NEW.data, 'DD/MM/YYYY') || '.' ||
                CASE WHEN v_item.observacao IS NOT NULL THEN E'\nObservação: ' || v_item.observacao ELSE '' END;

      INSERT INTO public.nao_conformidades (
        titulo, descricao, origem, pendencia_origem,
        severidade, classificacao, data_identificacao, status, created_by
      ) VALUES (
        v_titulo, v_desc, 'CHECKLIST_EQUIPAMENTO', 'checklist_execucoes:' || NEW.id::text,
        CASE v_item.criticidade WHEN 'ALTA' THEN 'ALTA' WHEN 'BAIXA' THEN 'BAIXA' ELSE 'MEDIA' END,
        'Não Conformidade', NEW.data, 'ABERTA', NEW.created_by
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_nc_checklist
AFTER UPDATE ON public.checklist_execucoes
FOR EACH ROW EXECUTE FUNCTION public.gerar_nc_de_checklist();