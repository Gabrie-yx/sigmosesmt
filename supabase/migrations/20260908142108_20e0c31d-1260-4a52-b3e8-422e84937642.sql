CREATE OR REPLACE FUNCTION public.desativar_empresa(_company_id uuid, _motivo text, _desligar_funcionarios boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _ativos int; _nome text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')) THEN
    RAISE EXCEPTION 'Sem permissão para desativar empresa';
  END IF;
  IF coalesce(length(trim(_motivo)), 0) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres)';
  END IF;

  SELECT name INTO _nome FROM public.companies WHERE id = _company_id;
  IF _nome IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  SELECT count(*) INTO _ativos FROM public.employees WHERE company_id = _company_id AND status = 'ATIVO';

  IF _ativos > 0 THEN
    IF NOT _desligar_funcionarios THEN
      RAISE EXCEPTION 'Empresa possui % funcionário(s) ativo(s). Desligue-os antes de desativar.', _ativos;
    END IF;

    UPDATE public.employees
       SET status = 'DESLIGADO',
           data_desligamento = COALESCE(data_desligamento, CURRENT_DATE),
           motivo_desligamento = COALESCE(NULLIF(motivo_desligamento, ''), 'Desativação da empresa ' || _nome),
           desligamento_observacoes = COALESCE(desligamento_observacoes, trim(_motivo)),
           updated_at = now()
     WHERE company_id = _company_id AND status = 'ATIVO';

    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'DESLIGAMENTO_EM_BLOCO', 'companies', _company_id,
            jsonb_build_object('empresa', _nome, 'ativos', _ativos),
            jsonb_build_object('motivo', trim(_motivo), 'em', now()));
  END IF;

  UPDATE public.companies
     SET status = 'DESATIVADA',
         data_desativacao = CURRENT_DATE,
         motivo_desativacao = COALESCE(NULLIF(trim(_motivo), ''), 'Encerramento de atividades'),
         updated_at = now()
   WHERE id = _company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_empresa_permanente(_company_id uuid, _justificativa text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_comp record;
  v_emp record;
  v_qtd int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir empresas permanentemente';
  END IF;

  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT id, name, cnpj, status INTO v_comp FROM public.companies WHERE id = _company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF COALESCE(v_comp.status, 'ATIVA') <> 'DESATIVADA' THEN
    RAISE EXCEPTION 'Desative a empresa antes de excluí-la definitivamente';
  END IF;

  SELECT count(*) INTO v_qtd FROM public.employees WHERE company_id = _company_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), 'HARD_DELETE_COMPANY', 'companies', _company_id,
          jsonb_build_object('id', v_comp.id, 'nome', v_comp.name, 'cnpj', v_comp.cnpj, 'funcionarios', v_qtd),
          jsonb_build_object('justificativa', trim(_justificativa), 'excluido_em', now()));

  PERFORM set_config('app.allow_hard_delete_employee', 'on', true);
  FOR v_emp IN SELECT id FROM public.employees WHERE company_id = _company_id LOOP
    DELETE FROM public.desligamento_pacotes WHERE employee_id = v_emp.id;
    DELETE FROM public.portaria_saidas_funcionarios WHERE employee_id = v_emp.id;
    DELETE FROM public.employees WHERE id = v_emp.id;
  END LOOP;
  PERFORM set_config('app.allow_hard_delete_employee', 'off', true);

  DELETE FROM public.companies WHERE id = _company_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_empresa_permanente(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.excluir_empresa_permanente(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desativar_empresa(uuid, text, boolean) TO authenticated;