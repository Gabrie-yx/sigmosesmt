
-- 1) Snapshots no exame
ALTER TABLE public.employee_exams
  ADD COLUMN IF NOT EXISTS role_id_at_exam uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ghe_id_at_exam uuid REFERENCES public.pgr_ghe(id) ON DELETE SET NULL;

-- 2) Histórico de mudança de função/GHE atrelado ao ASO
CREATE TABLE IF NOT EXISTS public.employee_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_exam_id uuid REFERENCES public.employee_exams(id) ON DELETE SET NULL,
  role_id_anterior uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  role_id_novo uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  ghe_id_anterior uuid REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  ghe_id_novo uuid REFERENCES public.pgr_ghe(id) ON DELETE SET NULL,
  motivo text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_role_hist_emp ON public.employee_role_history(employee_id, changed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_role_history TO authenticated;
GRANT ALL ON public.employee_role_history TO service_role;

ALTER TABLE public.employee_role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers can read role history"
  ON public.employee_role_history FOR SELECT
  TO authenticated
  USING (public.is_viewer_or_above(auth.uid()));

CREATE POLICY "Editors can insert role history"
  ON public.employee_role_history FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "Moderators can update role history"
  ON public.employee_role_history FOR UPDATE
  TO authenticated
  USING (public.is_moderator(auth.uid()))
  WITH CHECK (public.is_moderator(auth.uid()));

CREATE POLICY "Admins can delete role history"
  ON public.employee_role_history FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Trigger: snapshot automático + validação Mudança de Risco + histórico
CREATE OR REPLACE FUNCTION public.employee_exams_mudanca_risco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_atual uuid;
  v_ghe_atual uuid;
  v_prev RECORD;
BEGIN
  SELECT role_id, ghe_id INTO v_role_atual, v_ghe_atual
  FROM public.employees WHERE id = NEW.employee_id;

  -- Sempre snapshot do estado atual (se não vier explicitamente)
  IF NEW.role_id_at_exam IS NULL THEN NEW.role_id_at_exam := v_role_atual; END IF;
  IF NEW.ghe_id_at_exam IS NULL THEN NEW.ghe_id_at_exam := v_ghe_atual; END IF;

  -- Validação só para Mudança de Risco
  IF NEW.natureza IN ('Mudança de Risco Ocupacional','Mudança de Função','MUDANCA_RISCO','MUDANCA_FUNCAO') THEN
    SELECT role_id_at_exam, ghe_id_at_exam
      INTO v_prev
      FROM public.employee_exams
     WHERE employee_id = NEW.employee_id
       AND (TG_OP <> 'UPDATE' OR id <> NEW.id)
     ORDER BY data_realizacao DESC, created_at DESC
     LIMIT 1;

    IF v_prev.role_id_at_exam IS NOT NULL
       AND v_prev.role_id_at_exam IS NOT DISTINCT FROM NEW.role_id_at_exam
       AND v_prev.ghe_id_at_exam IS NOT DISTINCT FROM NEW.ghe_id_at_exam THEN
      RAISE EXCEPTION 'Não houve mudança de função/GHE desde o último ASO. Atualize o cargo ou GHE do funcionário antes de registrar um ASO de Mudança de Risco.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_exams_mudanca_risco ON public.employee_exams;
CREATE TRIGGER trg_employee_exams_mudanca_risco
  BEFORE INSERT OR UPDATE ON public.employee_exams
  FOR EACH ROW EXECUTE FUNCTION public.employee_exams_mudanca_risco();

-- 4) AFTER INSERT: registra histórico
CREATE OR REPLACE FUNCTION public.employee_exams_log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev RECORD;
BEGIN
  IF NEW.natureza NOT IN ('Mudança de Risco Ocupacional','Mudança de Função','MUDANCA_RISCO','MUDANCA_FUNCAO') THEN
    RETURN NEW;
  END IF;

  SELECT role_id_at_exam, ghe_id_at_exam
    INTO v_prev
    FROM public.employee_exams
   WHERE employee_id = NEW.employee_id
     AND id <> NEW.id
   ORDER BY data_realizacao DESC, created_at DESC
   LIMIT 1;

  INSERT INTO public.employee_role_history(
    employee_id, employee_exam_id,
    role_id_anterior, role_id_novo,
    ghe_id_anterior, ghe_id_novo,
    motivo, changed_by
  ) VALUES (
    NEW.employee_id, NEW.id,
    v_prev.role_id_at_exam, NEW.role_id_at_exam,
    v_prev.ghe_id_at_exam, NEW.ghe_id_at_exam,
    'ASO de Mudança de Risco Ocupacional', auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_exams_log_role_change ON public.employee_exams;
CREATE TRIGGER trg_employee_exams_log_role_change
  AFTER INSERT ON public.employee_exams
  FOR EACH ROW EXECUTE FUNCTION public.employee_exams_log_role_change();

-- 5) Backfill snapshot dos exames existentes
UPDATE public.employee_exams ex
   SET role_id_at_exam = e.role_id,
       ghe_id_at_exam = e.ghe_id
  FROM public.employees e
 WHERE ex.employee_id = e.id
   AND ex.role_id_at_exam IS NULL;
