
CREATE TABLE public.ponto_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia DATE NOT NULL,
  prazo_envio_rh DATE,
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_tratamento','aguardando_anderson','aprovado','enviado_rh','encerrado')),
  pdf_original_url TEXT,
  pdf_original_nome TEXT,
  pdf_consolidado_url TEXT,
  total_paginas INT,
  total_funcionarios INT,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  enviado_rh_em TIMESTAMPTZ,
  enviado_rh_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_ciclos TO authenticated;
GRANT ALL ON public.ponto_ciclos TO service_role;
ALTER TABLE public.ponto_ciclos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_ciclos_read" ON public.ponto_ciclos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
  OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
);
CREATE POLICY "ponto_ciclos_insert" ON public.ponto_ciclos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
);
CREATE POLICY "ponto_ciclos_update" ON public.ponto_ciclos FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
  OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
);
CREATE POLICY "ponto_ciclos_delete" ON public.ponto_ciclos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_ponto_ciclos_updated BEFORE UPDATE ON public.ponto_ciclos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ponto_folhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID NOT NULL REFERENCES public.ponto_ciclos(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  matricula TEXT NOT NULL,
  nome TEXT NOT NULL,
  cargo TEXT,
  local_trabalho TEXT,
  programacao TEXT,
  pagina_pdf INT,
  pdf_individual_url TEXT,
  pdf_final_url TEXT,
  total_trabalhado_min INT DEFAULT 0,
  total_faltas_min INT DEFAULT 0,
  total_he_50_min INT DEFAULT 0,
  total_he_100_min INT DEFAULT 0,
  total_atrasos_min INT DEFAULT 0,
  totais_json JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_tratamento','pronta_aprovacao','aprovada','rejeitada')),
  aprovada_por UUID REFERENCES auth.users(id),
  aprovada_em TIMESTAMPTZ,
  assinatura_url TEXT,
  carimbo_url TEXT,
  observacoes_aprovador TEXT,
  tratada_por UUID REFERENCES auth.users(id),
  tratada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_folhas_ciclo ON public.ponto_folhas(ciclo_id);
CREATE INDEX idx_ponto_folhas_status ON public.ponto_folhas(status);
CREATE INDEX idx_ponto_folhas_employee ON public.ponto_folhas(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_folhas TO authenticated;
GRANT ALL ON public.ponto_folhas TO service_role;
ALTER TABLE public.ponto_folhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_folhas_read" ON public.ponto_folhas FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
  OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
);
CREATE POLICY "ponto_folhas_insert" ON public.ponto_folhas FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
);
CREATE POLICY "ponto_folhas_update" ON public.ponto_folhas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
  OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
);
CREATE POLICY "ponto_folhas_delete" ON public.ponto_folhas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_ponto_folhas_updated BEFORE UPDATE ON public.ponto_folhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ponto_dias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_id UUID NOT NULL REFERENCES public.ponto_folhas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  dia_semana TEXT,
  escala_codigo TEXT,
  marcacoes TEXT[],
  status_sistema TEXT,
  minutos_trabalhados INT DEFAULT 0,
  minutos_he_50 INT DEFAULT 0,
  minutos_he_100 INT DEFAULT 0,
  minutos_atraso INT DEFAULT 0,
  precisa_tratativa BOOLEAN DEFAULT false,
  motivo_flag TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (folha_id, data)
);
CREATE INDEX idx_ponto_dias_folha ON public.ponto_dias(folha_id);
CREATE INDEX idx_ponto_dias_flag ON public.ponto_dias(precisa_tratativa) WHERE precisa_tratativa;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_dias TO authenticated;
GRANT ALL ON public.ponto_dias TO service_role;
ALTER TABLE public.ponto_dias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_dias_all" ON public.ponto_dias FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ponto_folhas f WHERE f.id = folha_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.ponto_folhas f WHERE f.id = folha_id));
CREATE TRIGGER trg_ponto_dias_updated BEFORE UPDATE ON public.ponto_dias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ponto_tratativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_id UUID NOT NULL REFERENCES public.ponto_dias(id) ON DELETE CASCADE,
  folha_id UUID NOT NULL REFERENCES public.ponto_folhas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'falta_atestado','falta_justificada','esquecimento_marcacao',
    'he_domingo','he_feriado','he_100_autorizada','atraso_justificado',
    'saida_antecipada','abono','outros'
  )),
  descricao TEXT NOT NULL,
  cid TEXT,
  data_inicio DATE,
  data_fim DATE,
  autorizado_por TEXT,
  anexo_url TEXT,
  anexo_nome TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_tratativas_dia ON public.ponto_tratativas(dia_id);
CREATE INDEX idx_ponto_tratativas_folha ON public.ponto_tratativas(folha_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_tratativas TO authenticated;
GRANT ALL ON public.ponto_tratativas TO service_role;
ALTER TABLE public.ponto_tratativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ponto_tratativas_all" ON public.ponto_tratativas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ponto_folhas f WHERE f.id = folha_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.ponto_folhas f WHERE f.id = folha_id));
CREATE TRIGGER trg_ponto_tratativas_updated BEFORE UPDATE ON public.ponto_tratativas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ponto_obj_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ponto' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
    OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
  )
);
CREATE POLICY "ponto_obj_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ponto' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
    OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
  )
);
CREATE POLICY "ponto_obj_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ponto' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.user_module_access WHERE user_id = auth.uid() AND module = 'administrativo' AND enabled)
    OR EXISTS (SELECT 1 FROM public.company_settings WHERE supervisor_geral_user_id = auth.uid())
  )
);
CREATE POLICY "ponto_obj_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ponto' AND public.has_role(auth.uid(), 'admin'));
