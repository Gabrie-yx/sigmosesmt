
-- Tabela mestre: cada sessão de integração realizada
CREATE TABLE public.integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_integracao DATE NOT NULL DEFAULT CURRENT_DATE,
  carga_horaria_h NUMERIC NOT NULL DEFAULT 1,
  instrutor_id UUID NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  instrutor_nome TEXT NOT NULL,
  local TEXT NULL,
  conteudo_programatico TEXT NULL,
  observacoes TEXT NULL,
  pdf_path TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracoes TO authenticated;
GRANT ALL ON public.integracoes TO service_role;
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read integracoes" ON public.integracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write integracoes" ON public.integracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update integracoes" ON public.integracoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete integracoes" ON public.integracoes FOR DELETE TO authenticated USING (true);

-- Participantes
CREATE TABLE public.integracao_participantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao_id UUID NOT NULL REFERENCES public.integracoes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  role_id UUID NULL REFERENCES public.roles(id) ON DELETE SET NULL,
  nome_snapshot TEXT NOT NULL,
  empresa_snapshot TEXT NULL,
  cargo_snapshot TEXT NULL,
  assinatura_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integracao_id, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracao_participantes TO authenticated;
GRANT ALL ON public.integracao_participantes TO service_role;
ALTER TABLE public.integracao_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read int part" ON public.integracao_participantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write int part" ON public.integracao_participantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update int part" ON public.integracao_participantes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete int part" ON public.integracao_participantes FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_int_part_emp ON public.integracao_participantes(employee_id);
CREATE INDEX idx_int_part_int ON public.integracao_participantes(integracao_id);
CREATE INDEX idx_integracoes_data ON public.integracoes(data_integracao DESC);

-- Trigger: ao inserir participante, atualiza employees.data_integracao se for mais recente
CREATE OR REPLACE FUNCTION public.sync_employee_data_integracao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data DATE;
BEGIN
  SELECT data_integracao INTO v_data FROM public.integracoes WHERE id = NEW.integracao_id;
  IF v_data IS NULL THEN RETURN NEW; END IF;
  UPDATE public.employees
    SET data_integracao = v_data
    WHERE id = NEW.employee_id
      AND (data_integracao IS NULL OR data_integracao < v_data);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_data_integracao
AFTER INSERT ON public.integracao_participantes
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_data_integracao();

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_integracoes_touch
BEFORE UPDATE ON public.integracoes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
