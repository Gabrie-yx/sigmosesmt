
CREATE TABLE public.employee_atestados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'ATESTADO' CHECK (tipo IN ('ATESTADO','DECLARACAO_COMPARECIMENTO','LICENCA_INSS','CAT')),
  data_inicio DATE NOT NULL,
  dias_afastamento INTEGER NOT NULL DEFAULT 0,
  data_retorno DATE GENERATED ALWAYS AS (data_inicio + dias_afastamento) STORED,
  cid TEXT,
  medico_nome TEXT,
  medico_crm TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','HOMOLOGADO','RECUSADO')),
  motivo_recusa TEXT,
  arquivo_path TEXT,
  observacao TEXT,
  homologado_em TIMESTAMPTZ,
  homologado_por UUID,
  override_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_atestados_emp ON public.employee_atestados(employee_id);
CREATE INDEX idx_atestados_periodo ON public.employee_atestados(data_inicio, data_retorno);
CREATE INDEX idx_atestados_status ON public.employee_atestados(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_atestados TO authenticated;
GRANT ALL ON public.employee_atestados TO service_role;

ALTER TABLE public.employee_atestados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viewers can read atestados" ON public.employee_atestados
  FOR SELECT TO authenticated USING (public.is_viewer_or_above(auth.uid()));
CREATE POLICY "editors can insert atestados" ON public.employee_atestados
  FOR INSERT TO authenticated WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "editors can update atestados" ON public.employee_atestados
  FOR UPDATE TO authenticated USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
CREATE POLICY "admins can delete atestados" ON public.employee_atestados
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_atestados_updated_at
  BEFORE UPDATE ON public.employee_atestados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.atestado_sync_override()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_override_id UUID;
BEGIN
  IF NEW.status = 'HOMOLOGADO' AND NEW.dias_afastamento > 0
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'HOMOLOGADO') THEN
    INSERT INTO public.safety_overrides (employee_id, tipo, motivo, data_inicio, data_fim, ativo, created_by)
    VALUES (NEW.employee_id, 'AFASTAMENTO_MEDICO',
      'Atestado homologado — ' || COALESCE(NEW.cid,'sem CID') || ' (' || NEW.dias_afastamento || ' dias)',
      NEW.data_inicio, NEW.data_retorno, true, COALESCE(NEW.homologado_por, NEW.created_by))
    RETURNING id INTO v_override_id;
    NEW.override_id := v_override_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'HOMOLOGADO' AND NEW.status <> 'HOMOLOGADO' AND OLD.override_id IS NOT NULL THEN
    UPDATE public.safety_overrides SET ativo = false WHERE id = OLD.override_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_atestado_sync_override
  BEFORE INSERT OR UPDATE ON public.employee_atestados
  FOR EACH ROW EXECUTE FUNCTION public.atestado_sync_override();
