-- 1) Tabela de convocações
CREATE TABLE public.convocacoes_exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  janela TEXT NOT NULL CHECK (janela IN ('VENCIDOS','30','60','90','TODOS')),
  tipos_exame TEXT[] NOT NULL DEFAULT '{}',
  convocado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  convocado_por UUID,
  data_limite DATE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','ATENDIDA','VENCIDA','CANCELADA')),
  atendida_em TIMESTAMPTZ,
  atendida_exam_id UUID REFERENCES public.employee_exams(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_convocacoes_employee ON public.convocacoes_exames(employee_id);
CREATE INDEX idx_convocacoes_status ON public.convocacoes_exames(status);
CREATE INDEX idx_convocacoes_convocado_em ON public.convocacoes_exames(convocado_em DESC);

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convocacoes_exames TO authenticated;
GRANT ALL ON public.convocacoes_exames TO service_role;

-- 3) RLS
ALTER TABLE public.convocacoes_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read convocacoes"
  ON public.convocacoes_exames FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editors can insert convocacoes"
  ON public.convocacoes_exames FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Editors can update convocacoes"
  ON public.convocacoes_exames FOR UPDATE
  TO authenticated
  USING (public.is_editor(auth.uid()))
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Moderators can delete convocacoes"
  ON public.convocacoes_exames FOR DELETE
  TO authenticated
  USING (public.is_moderator(auth.uid()));

-- 4) Trigger updated_at
CREATE TRIGGER trg_convocacoes_updated_at
  BEFORE UPDATE ON public.convocacoes_exames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Trigger: ao inserir exame, fecha convocações pendentes desse colaborador
CREATE OR REPLACE FUNCTION public.fechar_convocacoes_ao_registrar_exame()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.convocacoes_exames
     SET status = 'ATENDIDA',
         atendida_em = now(),
         atendida_exam_id = NEW.id,
         updated_at = now()
   WHERE employee_id = NEW.employee_id
     AND status = 'PENDENTE'
     AND convocado_em::date <= NEW.data_realizacao;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fechar_convocacoes_exame
  AFTER INSERT ON public.employee_exams
  FOR EACH ROW EXECUTE FUNCTION public.fechar_convocacoes_ao_registrar_exame();

-- 6) Função auxiliar para marcar vencidas (chamada manualmente ou via cron)
CREATE OR REPLACE FUNCTION public.marcar_convocacoes_vencidas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH upd AS (
    UPDATE public.convocacoes_exames
       SET status = 'VENCIDA', updated_at = now()
     WHERE status = 'PENDENTE'
       AND data_limite IS NOT NULL
       AND data_limite < CURRENT_DATE
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN COALESCE(v_count, 0);
END;
$$;