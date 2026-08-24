CREATE TABLE IF NOT EXISTS public.simulado_cenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  local text DEFAULT 'Produção',
  acao_preparatoria text DEFAULT 'Preparar o cenário para ação da brigada, kit primeiros socorros, extintores e etc.',
  responsavel text DEFAULT 'Técnico de segurança do trabalho, Brigadistas e Encarregado',
  periodicidade_meses integer NOT NULL DEFAULT 12,
  norma_ref text,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 99,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_cenarios TO authenticated;
GRANT ALL ON public.simulado_cenarios TO service_role;
ALTER TABLE public.simulado_cenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cenarios simulado" ON public.simulado_cenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cenarios simulado" ON public.simulado_cenarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cenarios simulado" ON public.simulado_cenarios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cenarios simulado" ON public.simulado_cenarios FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.simulado_cronograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  revisao text NOT NULL DEFAULT '00',
  data_documento date NOT NULL DEFAULT CURRENT_DATE,
  elaborado_por text,
  elaborado_assinatura text,
  aprovado_por text,
  aprovado_assinatura text,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_cronograma TO authenticated;
GRANT ALL ON public.simulado_cronograma TO service_role;
ALTER TABLE public.simulado_cronograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cronograma simulado" ON public.simulado_cronograma FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cronograma simulado" ON public.simulado_cronograma FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cronograma simulado" ON public.simulado_cronograma FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cronograma simulado" ON public.simulado_cronograma FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.simulado_cronograma_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_id uuid NOT NULL REFERENCES public.simulado_cronograma(id) ON DELETE CASCADE,
  cenario_id uuid REFERENCES public.simulado_cenarios(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 1,
  descricao text NOT NULL,
  local text,
  acao_preparatoria text,
  responsavel text,
  norma_ref text,
  meses jsonb NOT NULL DEFAULT '["","","","","","","","","","","",""]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulado_itens_cronograma ON public.simulado_cronograma_itens(cronograma_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_cronograma_itens TO authenticated;
GRANT ALL ON public.simulado_cronograma_itens TO service_role;
ALTER TABLE public.simulado_cronograma_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read itens simulado" ON public.simulado_cronograma_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert itens simulado" ON public.simulado_cronograma_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update itens simulado" ON public.simulado_cronograma_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete itens simulado" ON public.simulado_cronograma_itens FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.simulados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_item_id uuid REFERENCES public.simulado_cronograma_itens(id) ON DELETE SET NULL,
  ano integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  mes integer,
  cenario text NOT NULL,
  data_simulado date NOT NULL DEFAULT CURRENT_DATE,
  hora_alarme text,
  local text,
  escopo text NOT NULL DEFAULT 'PARCIAL',
  com_aviso boolean NOT NULL DEFAULT false,
  tempo_abandono_seg integer,
  tempo_resgate_seg integer,
  tempo_total_seg integer,
  qtd_participantes integer DEFAULT 0,
  qtd_brigadistas integer DEFAULT 0,
  recursos_acionados text,
  pontos_positivos text,
  falhas text,
  conceito text,
  nota numeric,
  observacoes text,
  participantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsavel_nome text,
  assinatura_tst text,
  assinatura_brigada text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulados_ano ON public.simulados(ano);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulados TO authenticated;
GRANT ALL ON public.simulados TO service_role;
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read simulados" ON public.simulados FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert simulados" ON public.simulados FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update simulados" ON public.simulados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete simulados" ON public.simulados FOR DELETE TO authenticated USING (true);

INSERT INTO public.simulado_cenarios (descricao, local, periodicidade_meses, norma_ref, padrao, ordem) VALUES
  ('Simulado de princípio de incêndio.', 'Produção', 12, 'NBR 15219 / NR-23', true, 1),
  ('Simulado de primeiros socorros', 'Produção', 12, 'NR-07 / NBR 15219', true, 2),
  ('Simulado de evacuação', 'Produção/ Administrativo', 12, 'NBR 15219 4.6.1', true, 3),
  ('Simulado resgate em espaço confinado', 'Produção', 12, 'NR-33 33.5.9.2', true, 4),
  ('Simulado resgate em trabalho em altura', 'Produção', 24, 'NR-35 35.4.2.2', true, 5),
  ('Simulado de resgate de afogado / homem ao mar', 'Cais / Área molhada', 12, 'NR-34 / NORMAM', false, 6),
  ('Simulado de acidente com animais peçonhentos', 'Produção / Área externa', 12, 'NR-07 / NR-31', false, 7),
  ('Simulado de Incidente com Múltiplas Vítimas (IMV)', 'Produção', 12, 'NBR 15219 / NR-07', false, 8)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';