
-- Tabela principal de registros de hora extra (sábado)
CREATE TABLE public.hora_extra_sabado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  turno TEXT,
  horario_inicio TEXT,
  horario_fim TEXT,
  setor TEXT,
  centro_custo TEXT,
  tipo_efetivo TEXT NOT NULL DEFAULT 'DMN', -- DMN, MEI, TERCEIRIZADO
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hora_extra_sabado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers can read hora_extra_sabado"
  ON public.hora_extra_sabado FOR SELECT
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editors can insert hora_extra_sabado"
  ON public.hora_extra_sabado FOR INSERT
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editors can update hora_extra_sabado"
  ON public.hora_extra_sabado FOR UPDATE
  USING (public.is_editor(auth.uid()));

CREATE POLICY "admin can delete hora_extra_sabado"
  ON public.hora_extra_sabado FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_hora_extra_sabado_updated_at
  BEFORE UPDATE ON public.hora_extra_sabado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de funcionários incluídos em cada registro
CREATE TABLE public.hora_extra_sabado_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hora_extra_id UUID NOT NULL REFERENCES public.hora_extra_sabado(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  nome TEXT NOT NULL, -- snapshot do nome (também usado para externos)
  externo BOOLEAN NOT NULL DEFAULT false,
  funcao TEXT,
  transporte BOOLEAN NOT NULL DEFAULT false,
  alimentacao BOOLEAN NOT NULL DEFAULT false,
  presenca TEXT, -- P (Presente), F (Faltou), NULL
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_he_sab_func_hora_extra ON public.hora_extra_sabado_funcionarios(hora_extra_id);

ALTER TABLE public.hora_extra_sabado_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers can read hora_extra_sabado_funcionarios"
  ON public.hora_extra_sabado_funcionarios FOR SELECT
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "editors can insert hora_extra_sabado_funcionarios"
  ON public.hora_extra_sabado_funcionarios FOR INSERT
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "editors can update hora_extra_sabado_funcionarios"
  ON public.hora_extra_sabado_funcionarios FOR UPDATE
  USING (public.is_editor(auth.uid()));

CREATE POLICY "editors can delete hora_extra_sabado_funcionarios"
  ON public.hora_extra_sabado_funcionarios FOR DELETE
  USING (public.is_editor(auth.uid()));
