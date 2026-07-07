
-- Onda 2 / Item 3: Trigger de mudança de cargo/GHE
CREATE OR REPLACE FUNCTION public.tg_employee_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_anterior_nome text;
  v_role_novo_nome text;
  v_ghe_anterior_nome text;
  v_ghe_novo_nome text;
  v_cursos_delta jsonb;
  v_qtd_delta int;
  v_changed_by uuid;
BEGIN
  -- Só dispara se role_id OU ghe_id mudaram de fato
  IF (NEW.role_id IS NOT DISTINCT FROM OLD.role_id)
     AND (NEW.ghe_id IS NOT DISTINCT FROM OLD.ghe_id) THEN
    RETURN NEW;
  END IF;

  v_changed_by := auth.uid();

  -- Nomes para auditoria
  SELECT nome INTO v_role_anterior_nome FROM public.roles WHERE id = OLD.role_id;
  SELECT nome INTO v_role_novo_nome FROM public.roles WHERE id = NEW.role_id;
  SELECT nome INTO v_ghe_anterior_nome FROM public.pgr_ghe WHERE id = OLD.ghe_id;
  SELECT nome INTO v_ghe_novo_nome FROM public.pgr_ghe WHERE id = NEW.ghe_id;

  -- Histórico de mudança de cargo
  INSERT INTO public.employee_role_history (
    employee_id,
    role_anterior_id,
    role_novo_id,
    ghe_anterior_id,
    ghe_novo_id,
    changed_by,
    changed_at,
    company_id
  ) VALUES (
    NEW.id,
    OLD.role_id,
    NEW.role_id,
    OLD.ghe_id,
    NEW.ghe_id,
    v_changed_by,
    now(),
    NEW.company_id
  );

  -- Delta: cursos exigidos pelo novo cargo que o funcionário nunca concluiu
  IF NEW.role_id IS NOT NULL THEN
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'course_id', tmc.id,
        'course_name', tmc.nome
      )), '[]'::jsonb),
      COUNT(*)
    INTO v_cursos_delta, v_qtd_delta
    FROM public.training_matrix_role_courses trc
    JOIN public.training_matrix_courses tmc ON tmc.id = trc.course_id
    WHERE trc.role_id = NEW.role_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.training_matrix_entries tme
        WHERE tme.employee_id = NEW.id
          AND tme.course_id = trc.course_id
          AND tme.data_conclusao IS NOT NULL
      );
  ELSE
    v_cursos_delta := '[]'::jsonb;
    v_qtd_delta := 0;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (
    company_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    NEW.company_id,
    v_changed_by,
    'mudanca_cargo',
    'employee',
    NEW.id::text,
    jsonb_build_object(
      'employee_nome', NEW.nome,
      'role_anterior_id', OLD.role_id,
      'role_anterior_nome', v_role_anterior_nome,
      'role_novo_id', NEW.role_id,
      'role_novo_nome', v_role_novo_nome,
      'ghe_anterior_id', OLD.ghe_id,
      'ghe_anterior_nome', v_ghe_anterior_nome,
      'ghe_novo_id', NEW.ghe_id,
      'ghe_novo_nome', v_ghe_novo_nome,
      'cursos_delta', v_cursos_delta,
      'qtd_cursos_pendentes', v_qtd_delta
    ),
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_employee_role_change() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_employee_role_change ON public.employees;
CREATE TRIGGER trg_employee_role_change
  AFTER UPDATE OF role_id, ghe_id ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_employee_role_change();
