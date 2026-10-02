CREATE OR REPLACE FUNCTION public.excluir_empresa_completa(_company_id uuid, _confirmacao text, _justificativa text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_comp record;
  v_emps uuid[];
  v_qtd int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir empresas';
  END IF;
  SELECT id, name, cnpj INTO v_comp FROM public.companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF upper(trim(coalesce(_confirmacao,''))) <> upper(trim(v_comp.name)) THEN
    RAISE EXCEPTION 'Confirmação não confere: digite exatamente o nome da empresa';
  END IF;
  IF _justificativa IS NULL OR length(trim(_justificativa)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres)';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_emps FROM public.employees WHERE company_id = _company_id;
  v_qtd := coalesce(array_length(v_emps,1),0);

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), 'HARD_DELETE_COMPANY_FULL', 'companies', _company_id,
    jsonb_build_object('nome', v_comp.name, 'cnpj', v_comp.cnpj, 'funcionarios', v_qtd),
    jsonb_build_object('justificativa', trim(_justificativa), 'excluido_em', now()));

  -- Registros da empresa
  DELETE FROM public.portaria_saidas_funcionarios WHERE employee_id = ANY(v_emps)
    OR saida_expediente_id IN (SELECT id FROM public.employee_saidas_expediente WHERE company_id = _company_id OR employee_id = ANY(v_emps));
  DELETE FROM public.employee_saidas_expediente WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.portaria_visitas WHERE empresa_visitada_id = _company_id;
  DELETE FROM public.employee_company_history WHERE empresa_antiga_id = _company_id OR empresa_nova_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.desligamento_pacotes WHERE employee_id = ANY(v_emps);
  DELETE FROM public.plano_acoes WHERE company_id = _company_id;
  DELETE FROM public.aprs WHERE empresa_id = _company_id;
  DELETE FROM public.ptes WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.nao_conformidades WHERE company_id = _company_id;
  DELETE FROM public.incidentes WHERE company_id = _company_id;
  DELETE FROM public.acidentes_trabalho WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.hora_extra_sabado_funcionarios WHERE employee_id = ANY(v_emps);
  DELETE FROM public.hora_extra_sabado WHERE company_id = _company_id;
  DELETE FROM public.ppp_emissoes WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.integracao_participantes WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.portaria_fornecedores_recorrentes WHERE company_id = _company_id;
  DELETE FROM public.inspecoes WHERE empresa_id = _company_id;
  DELETE FROM public.psico_denuncias WHERE company_id = _company_id;
  DELETE FROM public.epi_autorizacoes WHERE company_id = _company_id OR employee_id = ANY(v_emps);
  DELETE FROM public.dds WHERE company_id = _company_id;
  DELETE FROM public.sesmt_documents WHERE company_id = _company_id;
  UPDATE public.cascos SET empresa_responsavel_id = NULL WHERE empresa_responsavel_id = _company_id;

  -- Registros dos funcionários sem exclusão automática
  DELETE FROM public.apr_assinaturas WHERE employee_id = ANY(v_emps);
  DELETE FROM public.ponto_folhas WHERE employee_id = ANY(v_emps);
  DELETE FROM public.dds_attendees WHERE employee_id = ANY(v_emps);
  DELETE FROM public.dds_gestores WHERE employee_id = ANY(v_emps);
  DELETE FROM public.employee_vaccinations WHERE employee_id = ANY(v_emps);
  DELETE FROM public.procedimento_cientes WHERE employee_id = ANY(v_emps);
  DELETE FROM public.safety_overrides WHERE employee_id = ANY(v_emps);

  -- Funcionários (o restante — exames, EPIs, OS, treinamentos, atestados... — sai junto em cascata)
  PERFORM set_config('app.allow_hard_delete_employee', 'on', true);
  DELETE FROM public.employees WHERE id = ANY(v_emps);
  PERFORM set_config('app.allow_hard_delete_employee', 'off', true);

  DELETE FROM public.companies WHERE id = _company_id;
  RETURN jsonb_build_object('empresa', v_comp.name, 'funcionarios', v_qtd);
END;
$$;
REVOKE ALL ON FUNCTION public.excluir_empresa_completa(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_empresa_completa(uuid, text, text) TO authenticated;