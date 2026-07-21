
-- Fix hard delete de funcionário: FKs RESTRICT bloqueavam. Trocar por CASCADE
-- e reforçar a função para limpar filhos remanescentes antes do DELETE.

ALTER TABLE public.desligamento_pacotes
  DROP CONSTRAINT IF EXISTS desligamento_pacotes_employee_id_fkey,
  ADD CONSTRAINT desligamento_pacotes_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.portaria_saidas_funcionarios
  DROP CONSTRAINT IF EXISTS portaria_saidas_funcionarios_employee_id_fkey,
  ADD CONSTRAINT portaria_saidas_funcionarios_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

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

  PERFORM set_config('app.allow_hard_delete_employee', 'on', true);

  -- Limpeza defensiva: qualquer FK RESTRICT residual não deve travar a exclusão
  DELETE FROM public.desligamento_pacotes WHERE employee_id = _employee_id;
  DELETE FROM public.portaria_saidas_funcionarios WHERE employee_id = _employee_id;

  DELETE FROM public.employees WHERE id = _employee_id;
  PERFORM set_config('app.allow_hard_delete_employee', 'off', true);
END;
$function$;
