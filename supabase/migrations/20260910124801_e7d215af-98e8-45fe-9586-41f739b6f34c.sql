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

GRANT EXECUTE ON FUNCTION public.desativar_empresa(uuid, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';