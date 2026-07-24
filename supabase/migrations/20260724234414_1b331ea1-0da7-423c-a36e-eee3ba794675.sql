
-- ============ Atendimentos Médicos (fila do dia) ============
CREATE TABLE public.atendimentos_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  convocacao_id UUID REFERENCES public.convocacoes_exames(id) ON DELETE SET NULL,
  clinica_id UUID REFERENCES public.clinicas_ocupacionais(id) ON DELETE SET NULL,
  coordenador_id UUID REFERENCES public.pcmso_coordenadores(id) ON DELETE SET NULL,
  natureza TEXT NOT NULL DEFAULT 'PERIODICO',
  prioridade TEXT NOT NULL DEFAULT 'NORMAL',
  status TEXT NOT NULL DEFAULT 'AGENDADO',
  data_agendada DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_agendada TIME,
  chegou_em TIMESTAMPTZ,
  chamado_em TIMESTAMPTZ,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_data ON public.atendimentos_medicos(data_agendada, status);
CREATE INDEX idx_atendimentos_employee ON public.atendimentos_medicos(employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos_medicos TO authenticated;
GRANT ALL ON public.atendimentos_medicos TO service_role;

ALTER TABLE public.atendimentos_medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atendimentos_all_authenticated"
  ON public.atendimentos_medicos FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_atendimentos_updated
  BEFORE UPDATE ON public.atendimentos_medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Anamneses Ocupacionais (estruturada) ============
CREATE TABLE public.anamneses_ocupacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  atendimento_id UUID REFERENCES public.atendimentos_medicos(id) ON DELETE SET NULL,
  exam_id UUID REFERENCES public.employee_exams(id) ON DELETE SET NULL,
  natureza TEXT NOT NULL DEFAULT 'PERIODICO',
  medico_nome TEXT,
  medico_crm TEXT,
  data_anamnese DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Seções estruturadas (JSONB pra flexibilidade sem virar bagunça)
  queixa_principal TEXT,
  hda TEXT, -- História da Doença Atual
  antecedentes_pessoais JSONB NOT NULL DEFAULT '{}'::jsonb,   -- ex: {hipertensao:true, diabetes:false, cirurgias:"apendicectomia 2015"}
  antecedentes_familiares JSONB NOT NULL DEFAULT '{}'::jsonb,
  antecedentes_ocupacionais JSONB NOT NULL DEFAULT '[]'::jsonb, -- lista de empregos anteriores + riscos
  habitos JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- {tabagismo, etilismo, atividade_fisica, sono}
  medicacoes_uso TEXT,
  alergias TEXT,
  exame_fisico JSONB NOT NULL DEFAULT '{}'::jsonb,            -- PA, FC, peso, altura, IMC, ausculta, etc.
  hipoteses_diagnosticas TEXT,
  conduta TEXT,
  aptidao TEXT,                                                -- APTO / INAPTO / APTO_COM_RESTRICOES
  restricoes TEXT,
  observacoes TEXT,
  finalizada BOOLEAN NOT NULL DEFAULT false,
  finalizada_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anamneses_employee ON public.anamneses_ocupacionais(employee_id, data_anamnese DESC);
CREATE INDEX idx_anamneses_atendimento ON public.anamneses_ocupacionais(atendimento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamneses_ocupacionais TO authenticated;
GRANT ALL ON public.anamneses_ocupacionais TO service_role;

ALTER TABLE public.anamneses_ocupacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anamneses_all_authenticated"
  ON public.anamneses_ocupacionais FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_anamneses_updated
  BEFORE UPDATE ON public.anamneses_ocupacionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
