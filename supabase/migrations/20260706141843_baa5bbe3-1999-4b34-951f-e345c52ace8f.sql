CREATE OR REPLACE FUNCTION public.prevent_employee_delete_with_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf_digits text := regexp_replace(coalesce(OLD.cpf, ''), '\D', '', 'g');
  v_has_history boolean;
BEGIN
  -- Bypass quando chamada é a exclusão permanente por admin (via RPC excluir_funcionario_permanente)
  IF current_setting('app.allow_hard_delete_employee', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.epi_deliveries WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_exams WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_docs WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_atestados WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_vaccinations WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.employee_saidas_expediente WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.training_attendees WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.training_matrix_entries WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.dds_attendees WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.apr_assinaturas WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.oss_emissoes WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.ppp_emissoes WHERE employee_id = OLD.id
    UNION ALL SELECT 1 FROM public.historico_entregas
      WHERE v_cpf_digits <> ''
        AND regexp_replace(coalesce(cpf_colaborador, ''), '\D', '', 'g') = v_cpf_digits
    LIMIT 1
  ) INTO v_has_history;

  IF v_has_history THEN
    RAISE EXCEPTION 'Funcionário possui histórico vinculado e não pode ser excluído. Altere o status para INATIVO quando necessário.';
  END IF;

  RETURN OLD;
END;
$function$;

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
    jsonb_build_object('id', v_emp.id, 'nome', v_emp.nome, 'cpf', v_emp.cpf, 'matricula', v_emp.matricula, 'company_id', v_emp.company_id, 'status', v_emp.status),
    jsonb_build_object('justificativa', trim(_justificativa), 'excluido_em', now())
  );

  -- Permite o hard delete mesmo se houver histórico (admin já assumiu a responsabilidade)
  PERFORM set_config('app.allow_hard_delete_employee', 'on', true);
  DELETE FROM public.employees WHERE id = _employee_id;
  PERFORM set_config('app.allow_hard_delete_employee', 'off', true);
END;
$function$;