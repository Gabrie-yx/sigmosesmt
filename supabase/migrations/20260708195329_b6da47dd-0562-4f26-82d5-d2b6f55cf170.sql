-- Corrige segurança e consistência do fluxo de desligamento/reativação

-- 1) Reativação: exige editor + justificativa, e registra auditoria sem depender de variante antiga insegura.
CREATE OR REPLACE FUNCTION public.reativar_funcionario(
  _employee_id uuid,
  _motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_editor(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para reativar funcionário';
  END IF;

  IF _motivo IS NULL OR length(trim(_motivo)) < 5 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 5 caracteres) para reativação';
  END IF;

  UPDATE public.employees
     SET status = 'ATIVO',
         motivo_reativacao = trim(_motivo),
         data_reativacao = CURRENT_DATE,
         reativado_por = v_user,
         updated_at = now()
   WHERE id = _employee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  UPDATE public.safety_overrides
     SET ativo = false,
         revogado_por = v_user,
         revogado_em = now(),
         motivo_revogacao = 'Reativação: ' || trim(_motivo)
   WHERE employee_id = _employee_id
     AND ativo = true
     AND scope = 'GLOBAL';

  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
    VALUES (
      v_user,
      'REATIVAR_FUNCIONARIO',
      'employees',
      _employee_id,
      jsonb_build_object('motivo', trim(_motivo), 'data', CURRENT_DATE)
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (
        v_user,
        'REATIVAR_FUNCIONARIO',
        'employees',
        _employee_id,
        jsonb_build_object('motivo', trim(_motivo), 'data', CURRENT_DATE)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reativar_funcionario(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reativar_funcionario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_funcionario(uuid, text) TO service_role;

-- Variante antiga permitia reativação sem justificativa; o app não usa mais essa assinatura.
DROP FUNCTION IF EXISTS public.reativar_funcionario(uuid);

-- 2) Cascata do desligamento: revoga liberações antigas sem revogar o bloqueio global criado pelo desligamento.
CREATE OR REPLACE FUNCTION public.fechar_pendencias_ao_desligar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_convs_canceladas INT := 0;
  v_overrides_revogados INT := 0;
  v_portaria_bloqueadas INT := 0;
  v_cpf_norm TEXT;
  v_convocacao_demissional_id uuid;
BEGIN
  IF NEW.data_desligamento IS NULL OR OLD.data_desligamento IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WITH upd AS (
    UPDATE public.convocacoes_exames
       SET status = 'CANCELADA',
           observacoes = COALESCE(observacoes || E'\n', '')
                       || 'Cancelada automaticamente por desligamento em '
                       || to_char(NEW.data_desligamento, 'DD/MM/YYYY'),
           updated_at = now()
     WHERE employee_id = NEW.id
       AND status = 'PENDENTE'
       AND janela <> 'DEMISSIONAL'
    RETURNING 1
  )
  SELECT count(*) INTO v_convs_canceladas FROM upd;

  WITH upd AS (
    UPDATE public.safety_overrides
       SET ativo = false,
           revogado_por = COALESCE(NEW.desligado_por, auth.uid()),
           revogado_em = now(),
           motivo_revogacao = 'Revogado automaticamente por desligamento em ' || to_char(NEW.data_desligamento, 'DD/MM/YYYY')
     WHERE employee_id = NEW.id
       AND ativo = true
       AND NOT (
         scope = 'GLOBAL'
         AND COALESCE(justificativa, '') LIKE 'Funcionário desligado em%'
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_overrides_revogados FROM upd;

  v_cpf_norm := regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g');
  IF length(v_cpf_norm) = 11 THEN
    WITH upd AS (
      UPDATE public.portaria_pessoas
         SET bloqueado = true,
             motivo_bloqueio = 'Desligado em ' || to_char(NEW.data_desligamento, 'DD/MM/YYYY')
                            || COALESCE(' — ' || NEW.nome, ''),
             updated_at = now()
       WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_cpf_norm
         AND bloqueado = false
      RETURNING 1
    )
    SELECT count(*) INTO v_portaria_bloqueadas FROM upd;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.convocacoes_exames
     WHERE employee_id = NEW.id
       AND status = 'PENDENTE'
       AND janela = 'DEMISSIONAL'
  ) THEN
    INSERT INTO public.convocacoes_exames (
      employee_id, janela, tipos_exame,
      convocado_por, data_limite, status, observacoes
    ) VALUES (
      NEW.id,
      'DEMISSIONAL',
      ARRAY['Exame Médico Demissional'],
      NEW.desligado_por,
      NEW.data_desligamento,
      'PENDENTE',
      'Convocação automática — desligamento em '
        || to_char(NEW.data_desligamento, 'DD/MM/YYYY')
        || '. NR-07 7.5.1.V exige exame demissional em até 10 dias contados do término do contrato.'
    ) RETURNING id INTO v_convocacao_demissional_id;
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
      NEW.desligado_por,
      'desligamento_cascata',
      'employees',
      NEW.id,
      jsonb_build_object(
        'data_desligamento', NEW.data_desligamento,
        'convocacoes_canceladas', v_convs_canceladas,
        'overrides_revogados', v_overrides_revogados,
        'portaria_bloqueadas', v_portaria_bloqueadas,
        'convocacao_demissional_id', v_convocacao_demissional_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.audit_logs (user_id, action, entity, entity_id, metadata)
      VALUES (
        NEW.desligado_por,
        'desligamento_cascata',
        'employees',
        NEW.id,
        jsonb_build_object(
          'data_desligamento', NEW.data_desligamento,
          'convocacoes_canceladas', v_convs_canceladas,
          'overrides_revogados', v_overrides_revogados,
          'portaria_bloqueadas', v_portaria_bloqueadas,
          'convocacao_demissional_id', v_convocacao_demissional_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fechar_pendencias_ao_desligar() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.fechar_pendencias_ao_desligar() TO service_role;