CREATE OR REPLACE FUNCTION public.excluir_funcionario_permanente(_employee_id uuid, _justificativa text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir funcionários permanentemente';
  END IF;

  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT id, nome, cpf, matricula, company_id, status
    INTO v_emp
    FROM public.employees
   WHERE id = _employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    'HARD_DELETE_EMPLOYEE',
    'employees',
    _employee_id,
    jsonb_build_object(
      'id', v_emp.id,
      'nome', v_emp.nome,
      'cpf', v_emp.cpf,
      'matricula', v_emp.matricula,
      'company_id', v_emp.company_id,
      'status', v_emp.status
    ),
    jsonb_build_object(
      'justificativa', trim(_justificativa),
      'excluido_em', now()
    )
  );

  DELETE FROM public.employees WHERE id = _employee_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_funcionario_permanente(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_funcionario_permanente(uuid, text) TO authenticated;