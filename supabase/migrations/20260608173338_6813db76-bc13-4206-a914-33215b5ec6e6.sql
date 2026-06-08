
CREATE TABLE public.employee_saidas_expediente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_saida TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PESSOAL','SERVICO')),
  com_retorno BOOLEAN NOT NULL DEFAULT false,
  horario_retorno TEXT,
  motivo TEXT,
  assinatura_funcionario TEXT,
  assinatura_sesmt TEXT,
  assinado_sesmt_por UUID REFERENCES auth.users(id),
  assinado_sesmt_em TIMESTAMPTZ,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_saidas_expediente TO authenticated;
GRANT ALL ON public.employee_saidas_expediente TO service_role;

ALTER TABLE public.employee_saidas_expediente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewer reads saidas" ON public.employee_saidas_expediente
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "editor insert saidas" ON public.employee_saidas_expediente
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "editor update saidas" ON public.employee_saidas_expediente
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "admin delete saidas" ON public.employee_saidas_expediente
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX idx_saidas_employee ON public.employee_saidas_expediente(employee_id);
CREATE INDEX idx_saidas_data ON public.employee_saidas_expediente(data DESC);

CREATE TRIGGER trg_saidas_updated_at BEFORE UPDATE ON public.employee_saidas_expediente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
